
using System.Text.Json;
using MyAIApp.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpClient();
builder.Services.AddSingleton<IAiAssistantService, AiAssistantService>();
builder.Services.AddSingleton<ClientTemplateGenerator>();

builder.Services.AddAuthorization();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "client-forge" }));

app.MapGet("/api/config", (IConfiguration config) =>
{
    var provider = config["Ai:Provider"] ?? "local";
    var model = provider.ToLowerInvariant() switch
    {
        "ollama" => config["Ai:OllamaModel"],
        "openai" => config["Ai:OpenAiModel"],
        "azure-openai" or "azureopenai" => config["Ai:AzureOpenAiDeployment"],
        _ => null
    };

    return Results.Ok(new
    {
        provider,
        model,
        ollamaUrl = config["Ai:OllamaUrl"] ?? "http://localhost:11434",
        hasOpenAiKey = !string.IsNullOrWhiteSpace(config["Ai:OpenAiApiKey"]),
        hasAzureKey = !string.IsNullOrWhiteSpace(config["Ai:AzureOpenAiApiKey"])
    });
});

app.MapPost("/api/chat", async (ChatRequest request, IAiAssistantService assistantService) =>
{
    if (string.IsNullOrWhiteSpace(request.Prompt))
    {
        return Results.BadRequest(new { error = "Bitte gib eine Frage oder Anweisung ein." });
    }

    var reply = await assistantService.GetResponseAsync(request.Prompt, request.Provider, request.Model);
    return Results.Ok(new { reply });
});

app.MapPost("/api/design-assistant", async (DesignAssistantRequest request, IAiAssistantService assistantService, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Prompt))
    {
        return Results.BadRequest(new { error = "Bitte beschreibe deine Design-Idee." });
    }

    try
    {
        var current = new ClientDesignConfiguration(request.ClientName, request.AccentColor, request.Features);
        var suggestion = await assistantService.GetDesignSuggestionAsync(request.Prompt, current, request.Provider, request.Model, cancellationToken);
        return Results.Ok(suggestion);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
    catch (InvalidDataException ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
    catch (JsonException ex)
    {
        return Results.Problem(detail: $"Das KI-Modell hat eine ungültige Antwort geliefert: {ex.Message}", statusCode: StatusCodes.Status502BadGateway);
    }
});

app.MapPost("/api/game", async (GameRequest request, IAiAssistantService assistantService, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Prompt))
    {
        return Results.BadRequest(new { error = "Bitte gib eine Spielidee ein." });
    }

    try
    {
        var html = await assistantService.GenerateGameHtmlAsync(request.Prompt, request.Provider, request.Model, cancellationToken);
        return Results.Ok(new { html });
    }
    catch (InvalidOperationException ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
    catch (InvalidDataException ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
    catch (JsonException ex)
    {
        return Results.Problem(detail: $"Das KI-Modell hat eine ungültige Antwort geliefert: {ex.Message}", statusCode: StatusCodes.Status502BadGateway);
    }
});

app.MapPost("/api/client-template", (ClientTemplateRequest request, ClientTemplateGenerator generator) =>
{
    try
    {
        var archive = generator.Generate(request);
        return Results.File(archive, "application/zip", generator.GetFileName(request.ClientName));
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapFallbackToFile("index.html");

app.Run();

public sealed record ChatRequest(string Prompt, string? Provider = null, string? Model = null);
public sealed record DesignAssistantRequest(
    string Prompt,
    string? ClientName = null,
    string? AccentColor = null,
    string?[]? Features = null,
    string? Provider = null,
    string? Model = null);
public sealed record GameRequest(string Prompt, string? Provider = null, string? Model = null);
public sealed record ClientTemplateRequest(
    string? ClientName,
    string? PackageName,
    string? AccentColor,
    string?[]? Features);
