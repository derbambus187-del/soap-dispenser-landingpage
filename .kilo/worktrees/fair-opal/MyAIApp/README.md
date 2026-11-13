# Client Forge

Client Forge ist ein deutschsprachiger Builder für eigenständige Minecraft-Client-Starterprojekte. Er kombiniert eine konfigurierbare Live-Vorschau, optionale KI-Designberatung und einen ZIP-Export für Fabric.

## Funktionen

- Eigenes Client-Menü mit frei wählbarem Namen und Akzentfarbe
- HUD-Auswahl für FPS, Koordinaten, Minecraft-Weltzeit, WASD-Tasten und Rüstungsstatus
- Clientseitiges Fabric-Projektgerüst für Minecraft 26.2 und Java 25
- HUD-Module zur Laufzeit im Client-Menü aktivier- und deaktivierbar
- KI-Beratung über Ollama, OpenAI oder Azure OpenAI
- KI-Designvorschläge für Client-Name, Akzentfarbe und faire HUD-Module, direkt übernehmbar
- Lokale, regelbasierte Designvorschläge ohne API-Schlüssel
- Browserseitige Speicherung der letzten Builder-Einstellungen
- Kein Login und kein Datenspeicher erforderlich

Die Vorlage ist eine unabhängige Implementierung. Sie kopiert weder Code noch Assets von OneClient, NoRiskClient oder anderen Clients und enthält keine Cheats, Exploits, Kampf-/Bewegungsautomatisierung oder Anti-Cheat-Umgehung.

## Starten

```bash
dotnet run --project MyAIApp
```

Öffne anschließend die von ASP.NET Core ausgegebene lokale URL. Im Builder kannst du die Client-Einstellungen anpassen und als ZIP exportieren. Das exportierte Projekt benötigt Java 25 und Gradle 9.9 oder neuer.

### Mapping-Status für 26.2

Mojang veröffentlicht für Minecraft 26.2 derzeit keine Client-Mappings im offiziellen Versionsmanifest; Fabric Meta liefert außerdem noch keine Yarn-Mappings für diese Version. Dadurch kann Loom den Minecraft-Build aktuell nicht einrichten. Der ZIP-Export und die Client-Konfiguration funktionieren, aber `gradle build` und `gradle runClient` bleiben blockiert, bis passende Mappings verfügbar sind. Der Export enthält den Hinweis ebenfalls in seiner README.

## KI konfigurieren

Ohne Konfiguration ist der lokale Modus aktiv. Für echte Modellantworten kann Ollama lokal verwendet werden:

```json
"Ai": {
  "Provider": "ollama",
  "OllamaUrl": "http://localhost:11434",
  "OllamaModel": "llama3.2"
}
```

Alternativ können OpenAI oder Azure OpenAI über Umgebungsvariablen eingerichtet werden:

```bash
export Ai__OpenAiApiKey="dein-key"
export Ai__AzureOpenAiApiKey="dein-key"
export Ai__AzureOpenAiEndpoint="https://dein-resource.openai.azure.com"
```

Geheimnisse gehören nicht in die Versionsverwaltung. Die KI-Designberatung gibt Vorschläge; der ZIP-Export erzeugt eine nachvollziehbare, deterministische Vorlage aus den ausgewählten Einstellungen.

## API

- `GET /api/health` — Status
- `GET /api/config` — aktiver KI-Anbieter und Modellkonfiguration
- `POST /api/chat` — KI-Designberatung
- `POST /api/design-assistant` — Designvorschlag mit Erklärung und übernehmbarer Konfiguration
- `POST /api/client-template` — validierten Fabric-Starter als ZIP erzeugen

`/api/design-assistant` akzeptiert `prompt`, `clientName`, `accentColor`, `features`, `provider` und `model`. Die Antwort enthält `reply` sowie die vorgeschlagenen Werte für `clientName`, `accentColor` und `features`.
`/api/game` akzeptiert `prompt`, `provider` und `model`; im lokalen Modus fällt die App auf eine deterministische Browser-Mini-Game-Vorlage zurück, damit die Funktion ohne externe KI-Konfiguration nutzbar bleibt.
Der Export-Endpunkt akzeptiert `clientName`, `packageName`, `accentColor` und `features`. Unterstützte Feature-IDs sind `fps`, `coordinates`, `clock`, `keystrokes` und `armor`.
