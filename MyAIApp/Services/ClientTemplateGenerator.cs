using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;

namespace MyAIApp.Services;

public sealed class ClientTemplateGenerator
{
    private static readonly string[] SupportedFeatures =
    [
        "fps",
        "coordinates",
        "clock",
        "keystrokes",
        "armor"
    ];

    public byte[] Generate(ClientTemplateRequest request)
    {
        var clientName = ValidateClientName(request.ClientName);
        var packageName = ValidatePackageName(request.PackageName);
        var accentColor = ValidateAccentColor(request.AccentColor);
        var selectedFeatures = ValidateFeatures(request.Features);
        var packagePath = packageName.Replace('.', '/');
        var javaClassName = $"{ToJavaIdentifier(clientName)}Client";
        var enabledFeatures = string.Join(
            Environment.NewLine,
            SupportedFeatures.Select(feature =>
                $"    public static boolean SHOW_{feature.ToUpperInvariant()} = {selectedFeatures.Contains(feature).ToString().ToLowerInvariant()};"));

        var files = new Dictionary<string, string>
        {
            [".gitignore"] = """
                .gradle/
                build/
                run/
                out/
                *.iml
                .idea/
                """,
            ["README.md"] = BuildReadme(clientName, selectedFeatures),
            ["settings.gradle"] = """
                pluginManagement {
                    repositories {
                        maven { url = 'https://maven.fabricmc.net/' }
                        gradlePluginPortal()
                        mavenCentral()
                    }
                }

                rootProject.name = 'CLIENT_SLUG'
                """.Replace("CLIENT_SLUG", ToSlug(clientName), StringComparison.Ordinal),
            ["build.gradle"] = """
                plugins {
                    id 'fabric-loom' version "${loom_version}"
                }

                loom {
                    splitEnvironmentSourceSets()
                    mods {
                        "${mod_id}" {
                            sourceSet sourceSets.main
                            sourceSet sourceSets.client
                        }
                    }
                }

                version = project.mod_version
                group = project.maven_group
                base {
                    archivesName = project.archives_base_name
                }

                dependencies {
                    minecraft "com.mojang:minecraft:${project.minecraft_version}"
                    mappings loom.officialMojangMappings()
                    modImplementation "net.fabricmc:fabric-loader:${project.loader_version}"
                    modImplementation "net.fabricmc.fabric-api:fabric-api:${project.fabric_api_version}"
                }

                processResources {
                    inputs.property 'version', project.version
                    filesMatching('fabric.mod.json') {
                        expand version: project.version
                    }
                }

                java {
                    toolchain {
                        languageVersion = JavaLanguageVersion.of(25)
                    }
                    withSourcesJar()
                }

                tasks.withType(JavaCompile).configureEach {
                    options.release = 25
                }
                """,
            ["gradle.properties"] = """
                org.gradle.jvmargs=-Xmx2G
                org.gradle.parallel=true

                minecraft_version=26.2
                loader_version=0.20.1
                fabric_api_version=0.161.0+26.2
                loom_version=1.20.0-alpha.22

                mod_version=1.0.0
                mod_id=CLIENT_MOD_ID
                maven_group=CLIENT_PACKAGE
                archives_base_name=CLIENT_SLUG
                """.Replace("CLIENT_PACKAGE", packageName, StringComparison.Ordinal)
                .Replace("CLIENT_MOD_ID", ToSlug(clientName).Replace('-', '_'), StringComparison.Ordinal)
                .Replace("CLIENT_SLUG", ToSlug(clientName), StringComparison.Ordinal),
            ["src/main/resources/fabric.mod.json"] = BuildFabricManifest(clientName, packageName, javaClassName),
            [$"src/client/java/{packagePath}/ClientSettings.java"] = BuildSettingsClass(packageName, accentColor, enabledFeatures),
            [$"src/client/java/{packagePath}/{javaClassName}.java"] = BuildClientClass(packageName, javaClassName),
            [$"src/client/java/{packagePath}/ClientTemplateScreen.java"] = BuildScreenClass(packageName)
        };

        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (path, content) in files)
            {
                var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
                using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
                writer.Write(content);
            }
        }

        return output.ToArray();
    }

    public string GetFileName(string? clientName) => $"{ToSlug(ValidateClientName(clientName))}.zip";

    private static string ValidateClientName(string? value)
    {
        if (value is null || !Regex.IsMatch(value, "^[A-Za-z0-9][A-Za-z0-9 _-]{2,31}$", RegexOptions.CultureInvariant))
        {
            throw new ArgumentException("Der Client-Name muss 3 bis 32 Zeichen lang sein und darf nur Buchstaben, Zahlen, Leerzeichen, _ und - enthalten.");
        }

        return value.Trim();
    }

    private static string ValidatePackageName(string? value)
    {
        if (value is null || !Regex.IsMatch(value, "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*){1,5}$", RegexOptions.CultureInvariant))
        {
            throw new ArgumentException("Das Java-Paket muss aus mindestens zwei kleingeschriebenen Segmenten bestehen, z. B. dev.meinclient.starter.");
        }

        return value;
    }

    private static string ValidateAccentColor(string? value)
    {
        if (value is null || !Regex.IsMatch(value, "^#[0-9a-fA-F]{6}$", RegexOptions.CultureInvariant))
        {
            throw new ArgumentException("Die Akzentfarbe muss ein Hex-Farbwert wie #36d399 sein.");
        }

        return value;
    }

    private static HashSet<string> ValidateFeatures(string?[]? values)
    {
        if (values is null || values.Length > SupportedFeatures.Length)
        {
            throw new ArgumentException("Bitte wähle gültige HUD-Module aus.");
        }

        var selected = new HashSet<string>(StringComparer.Ordinal);
        foreach (var value in values)
        {
            if (value is null || !SupportedFeatures.Contains(value, StringComparer.Ordinal) || !selected.Add(value))
            {
                throw new ArgumentException("Die Auswahl enthält ein unbekanntes oder doppeltes HUD-Modul.");
            }
        }

        return selected;
    }

    private static string BuildReadme(string clientName, HashSet<string> features)
    {
        var featureList = features.Count == 0
            ? "- Keine HUD-Module vorausgewählt. Öffne das Client-Menü mit Rechts-Shift."
            : string.Join(Environment.NewLine, features.Select(feature => $"- {FeatureLabel(feature)}"));

        return $$"""
            # {{clientName}}

            Ein eigenständiges, clientseitiges Fabric-Starterprojekt mit anpassbarem Menü und optionalen Informations-HUDs.
            Es enthält keine Kampf-, Bewegungs-, Exploit- oder Anti-Cheat-Umgehungsfunktionen.

            ## Starten

            - Java 25 und Gradle 9.9 oder neuer installieren.
            - Der Zielbuild ist Minecraft 26.2 mit Fabric Loom 1.20.0-alpha.22 und offiziellen Mojang-Mappings.
            - `gradle runClient` startet Minecraft im Entwicklungsmodus, sobald passende 26.2-Mappings veröffentlicht sind.
            - `gradle build` erstellt anschließend die Mod-JAR unter `build/libs/`.
            - Das Client-Menü ist im Titelbildschirm verlinkt und während des Spiels mit Rechts-Shift erreichbar.

            ## Enthaltene HUD-Module

            {{featureList}}

            Die Module lassen sich im Client-Menü zur Laufzeit ein- und ausschalten. Der gewählte Akzentfarbwert steht in `ClientSettings.java`.
            **Kompatibilitätshinweis:** Zum Erstellungszeitpunkt veröffentlicht Mojang für Minecraft 26.2 keine Client-Mappings im Versionsmanifest; Fabric Meta liefert außerdem noch keine Yarn-Mappings für 26.2. Loom kann den Minecraft-Build daher aktuell nicht aufsetzen. Sobald passende Mappings verfügbar sind, müssen Toolchain und API erneut geprüft werden.

            Ziel: Minecraft 26.2, Fabric, Java 25 und offizielle Mojang-Mappings.
            """;
    }

    private static string FeatureLabel(string feature) => feature switch
    {
        "fps" => "FPS-Anzeige",
        "coordinates" => "Koordinaten",
        "clock" => "Weltzeit",
        "keystrokes" => "Tastenanzeige (WASD)",
        "armor" => "Rüstungsstatus",
        _ => feature
    };

    private static string BuildFabricManifest(string clientName, string packageName, string javaClassName)
    {
        var modId = ToSlug(clientName).Replace('-', '_');
        return $$"""
            {
              "schemaVersion": 1,
              "id": "{{modId}}",
              "version": "${version}",
              "name": "{{clientName}}",
              "description": "Original client menu and informational HUD starter.",
              "environment": "client",
              "entrypoints": {
                "client": [
                  "{{packageName}}.{{javaClassName}}"
                ]
              },
              "depends": {
                "fabricloader": ">=0.20.1",
                "minecraft": "26.2",
                "java": ">=25",
                "fabric-api": "*"
              }
            }
            """;
    }

    private static string BuildSettingsClass(string packageName, string accentColor, string enabledFeatures)
    {
        var color = Convert.ToInt32(accentColor[1..], 16);
        return $$"""
            package {{packageName}};

            public final class ClientSettings {
                public static final int ACCENT_COLOR = 0x{{color:X6}};
            {{enabledFeatures}}

                private ClientSettings() {
                }
            }
            """;
    }

    private static string BuildClientClass(string packageName, string javaClassName)
    {
        return $$"""
            package {{packageName}};

            import com.mojang.blaze3d.platform.InputConstants;
            import net.fabricmc.api.ClientModInitializer;
            import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
            import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
            import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
            import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
            import net.minecraft.client.KeyMapping;
            import net.minecraft.client.Minecraft;
            import net.minecraft.client.gui.GuiGraphics;
            import net.minecraft.client.gui.screens.TitleScreen;
            import net.minecraft.network.chat.Component;
            import org.lwjgl.glfw.GLFW;

            public final class {{javaClassName}} implements ClientModInitializer {
                private static KeyMapping openMenuKey;
                private static int cachedWorldMinute = -1;
                private static String cachedWorldClock = "00:00";

                @Override
                public void onInitializeClient() {
                    openMenuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
                        "key.clienttemplate.open_menu",
                        InputConstants.Type.KEYSYM,
                        GLFW.GLFW_KEY_RIGHT_SHIFT,
                        KeyMapping.Category.MISC
                    ));

                    ClientTickEvents.END_CLIENT_TICK.register(minecraft -> {
                        while (openMenuKey.consumeClick()) {
                            minecraft.setScreen(new ClientTemplateScreen(minecraft.screen));
                        }
                    });

                    ScreenEvents.AFTER_INIT.register((minecraft, screen, scaledWidth, scaledHeight) -> {
                        if (screen instanceof TitleScreen) {
                            screen.addRenderableWidget(net.minecraft.client.gui.components.Button.builder(
                                Component.literal("Client-Menü"),
                                button -> minecraft.setScreen(new ClientTemplateScreen(screen))
                            ).bounds(scaledWidth / 2 - 100, scaledHeight / 4 + 168, 200, 20).build());
                        }
                    });

                    HudRenderCallback.EVENT.register((graphics, tickCounter) -> renderHud(graphics));
                }

                private static void renderHud(GuiGraphics graphics) {
                    Minecraft minecraft = Minecraft.getInstance();
                    if (minecraft.player == null || minecraft.level == null) {
                        return;
                    }

                    int y = 8;
                    if (ClientSettings.SHOW_FPS) {
                        y = drawLine(graphics, "FPS " + minecraft.getFps(), y);
                    }
                    if (ClientSettings.SHOW_COORDINATES) {
                        var position = minecraft.player.blockPosition();
                        y = drawLine(graphics, "XYZ " + position.getX() + " " + position.getY() + " " + position.getZ(), y);
                    }
                    if (ClientSettings.SHOW_CLOCK) {
                        long dayTime = minecraft.level.getDayTime() % 24000L;
                        int worldMinute = (int) (dayTime * 60L / 24000L);
                        if (worldMinute != cachedWorldMinute) {
                            cachedWorldMinute = worldMinute;
                            cachedWorldClock = String.format("%02d:%02d", worldMinute / 60, worldMinute % 60);
                        }
                        y = drawLine(graphics, "Weltzeit " + cachedWorldClock, y);
                    }
                    if (ClientSettings.SHOW_ARMOR) {
                        y = drawLine(graphics, "Ruestung " + minecraft.player.getArmorValue(), y);
                    }
                    if (ClientSettings.SHOW_KEYSTROKES) {
                        int color = ClientSettings.ACCENT_COLOR;
                        String keys = (minecraft.options.keyUp.isDown() ? "[W]" : " W ")
                            + (minecraft.options.keyLeft.isDown() ? "[A]" : " A ")
                            + (minecraft.options.keyDown.isDown() ? "[S]" : " S ")
                            + (minecraft.options.keyRight.isDown() ? "[D]" : " D ");
                        graphics.drawString(minecraft.font, Component.literal(keys), 8, y, color, true);
                    }
                }

                private static int drawLine(GuiGraphics graphics, String value, int y) {
                    Minecraft minecraft = Minecraft.getInstance();
                    graphics.drawString(minecraft.font, Component.literal(value), 8, y, ClientSettings.ACCENT_COLOR, true);
                    return y + 12;
                }
            }
            """;
    }

    private static string BuildScreenClass(string packageName)
    {
        return $$"""
            package {{packageName}};

            import java.util.function.BooleanSupplier;
            import java.util.function.Consumer;
            import net.minecraft.client.Minecraft;
            import net.minecraft.client.gui.GuiGraphics;
            import net.minecraft.client.gui.components.Button;
            import net.minecraft.client.gui.screens.Screen;
            import net.minecraft.network.chat.Component;

            public final class ClientTemplateScreen extends Screen {
                private final Screen parent;

                public ClientTemplateScreen(Screen parent) {
                    super(Component.literal("Client-Menü"));
                    this.parent = parent;
                }

                @Override
                protected void init() {
                    int buttonWidth = 150;
                    int gap = 10;
                    int left = width / 2 - buttonWidth - gap / 2;
                    int right = width / 2 + gap / 2;
                    int top = height / 2 - 65;

                    addToggle("FPS-HUD", () -> ClientSettings.SHOW_FPS, value -> ClientSettings.SHOW_FPS = value, left, top);
                    addToggle("Koordinaten", () -> ClientSettings.SHOW_COORDINATES, value -> ClientSettings.SHOW_COORDINATES = value, right, top);
                    addToggle("Weltzeit", () -> ClientSettings.SHOW_CLOCK, value -> ClientSettings.SHOW_CLOCK = value, left, top + 25);
                    addToggle("Tastenanzeige", () -> ClientSettings.SHOW_KEYSTROKES, value -> ClientSettings.SHOW_KEYSTROKES = value, right, top + 25);
                    addToggle("Ruestungsstatus", () -> ClientSettings.SHOW_ARMOR, value -> ClientSettings.SHOW_ARMOR = value, left, top + 50);

                    addRenderableWidget(Button.builder(Component.literal("Zurueck"), button -> minecraft.setScreen(parent))
                        .bounds(width / 2 - 100, top + 88, 200, 20).build());
                }

                private void addToggle(String label, BooleanSupplier getter, Consumer<Boolean> setter, int x, int y) {
                    addRenderableWidget(Button.builder(toggleText(label, getter.getAsBoolean()), button -> {
                        boolean enabled = !getter.getAsBoolean();
                        setter.accept(enabled);
                        button.setMessage(toggleText(label, enabled));
                    }).bounds(x, y, 150, 20).build());
                }

                private static Component toggleText(String label, boolean enabled) {
                    return Component.literal(label + ": " + (enabled ? "AN" : "AUS"));
                }

                @Override
                public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
                    renderBackground(graphics, mouseX, mouseY, delta);
                    graphics.drawCenteredString(font, title, width / 2, height / 2 - 105, ClientSettings.ACCENT_COLOR);
                    graphics.drawCenteredString(font, Component.literal("Visuelle HUDs und Client-Einstellungen"), width / 2, height / 2 - 88, 0xFFFFFF);
                    super.render(graphics, mouseX, mouseY, delta);
                }

                @Override
                public void close() {
                    Minecraft.getInstance().setScreen(parent);
                }
            }
            """;
    }

    private static string ToJavaIdentifier(string value)
    {
        var parts = Regex.Split(value, "[^A-Za-z0-9]+").Where(part => part.Length > 0);
        var identifier = string.Concat(parts.Select(part => char.ToUpperInvariant(part[0]) + part[1..]));
        return identifier.Length == 0 ? "Custom" : identifier;
    }

    private static string ToSlug(string value) =>
        Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
}
