# TODO / Inventory

## Översikt över appar

### @app/condo (Keystone + Next hybrid)

Huvudplattform: fastigheter, ärenden, användare, organisationer, mätare, fakturering, notifieringar, marknadsplats, dokument, AI, onboarding, miniapp-integration, webhookar.

Nyckelfunktioner:

- Keystone GraphQL API och admin UI
- Domäner: user, organization, property, ticket, resident, billing, banking, meter, subscription, acquiring (betalningar), analytics, news, marketplace, document, ai, onboarding, scope, settings, contact, notification
- Filuppladdning (FileAdapter)
- Feature flags, OIDC, versionering, webhook-modeller
- Köer (low/medium/high) och async tasks
- Hälsokontroller (Redis/Postgres/certifikat)

### @app/address-service (Keystone + Admin UI)

Adressuppslag och hantering av adressdatatjänster.

Nyckelfunktioner:

- Keystone API
- OIDC inloggning mot condo
- Extern adress-provider (dadata m.fl.)
- Domän: address-service/domains (adressnormalisering, förslag)

### @app/miniapp (Keystone + Next)

Miniappar som kompletterar huvudplattformen och integrerar mot condo.

Nyckelfunktioner:

- Stitchade scheman mot condo (delad data)
- Eget Keystone + Next UI
- Autentisering via OIDC / shared integration
- Domän: miniapp/domains (bridge till condo, UI-flöden)

### @app/dev-portal-api (Keystone API)

API för utvecklar-/integrationsportal.

Nyckelfunktioner:

- Keystone GraphQL API (separat från condo)
- Skapar och hanterar dev/prod bot users
- Miniapp- och B2B-app hantering (registrering, service users)
- Miljö-/OIDC-konfiguration mot condo

### @app/dev-portal-web (Next.js ren web)

Publik/partnerportal frontend.

Nyckelfunktioner:

- Next.js SSR/ISR
- Apollo Client mot dev-portal-api och ev. condo
- MDX/Docs render (next-mdx-remote)
- SEO (next-seo)
- UI-komponenter från @open-condo/ui

## Prioriteringsförslag (att besluta)

1. Identifiera vilka domäner i @app/condo som behövs.
2. Bestäm om miniapp och dev-portal behövs initialt.
3. Kartlägg adressbehov: behövs address-service eller räcker enklare fält.
4. Minimera beroenden: avaktivera oanvända domäner initialt.

## Nästa möjliga steg

- [ ] Lägg till diagnosscript (bin/diagnostics.js)
- [ ] Skapa POC-app med reducerat schema
- [ ] Dokumentera vilka env-variabler som faktiskt används lokalt
- [ ] Lista migrations beroende på utvalda domäner
- [ ] Markera domäner att ta bort/ignorera i första iteration

## KV / Redis migration (2.x -> 3.x -> 4.x kontext)

Mål: Flytta från hårt Redis-bunden setup till generisk KV (Valkey-kompatibel) + prefixade nycklar.

Motivation (kort):

- Licens / uppdateringsbegränsningar i Redis
- Stöd för kluster utan virtuella databaser (ersätter db-index med key-prefix)
- Förbereda skalning & multi-app på samma kluster

Plan lokalt (minimal insats):

1. Stoppa alla appar/worker.
2. Kör: `npx @open-condo/migrator add-apps-kv-prefixes` (från repo-roten).
3. Starta om appar (dev / worker) och verifiera att nycklar får prefix (ex: `condo:bull:...` ).

Plan remote (enkel downtime):

- Säkerhetskopia KV.
- Stoppa app + worker för aktuell app.
- `npx @open-condo/migrator add-apps-kv-prefixes -f {app_namn}`
- Deploy 3.x / start.

Avancerad (nära noll-downtime): RedisShake + parallell instans + prefix-funktion -> switch av endpoint.

Risker:

- Blandning av oprefixade/prefixade keys (inconsistent state)
- Tasks i Bull köer mitt under migrering (förlust) -> pausa worker först
- Legacy imports av `@open-condo/keystone/redis`

Åtgärdspunkter:

- [ ] Sök efter gamla imports: `grep -R "@open-condo/keystone/redis" .`
- [ ] Verifiera att endast `@open-condo/keystone/kv` används.
- [ ] Lista nyckelvolym före migrering (INFO keyspace / SCAN provtagning).
- [ ] Dokumentera lokalt prefix (paketnamn -> snake_case) i README-ANPASSNING.md.
- [ ] Testa migrator lokalt och logga körtid.
- [ ] Lägg till check i diagnosscript: varna om `data_version != 2` efter migrering.
- [ ] Definiera rollback (spara dump.rdb före körning).

Uppföljning:

- [ ] Efter start: kontrollera slumpnyckel: `GET {prefix}:data_version` (ska vara 2)
- [ ] Verifiera bull könycklar har `{prefix:bull:{queue}}` hash-tag format.

(Fråga om fördjupning -> jag fyller på listan.)

(Lägg till fler punkter genom att be om dem i chatten.)
