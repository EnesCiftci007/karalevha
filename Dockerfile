FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY Karalevha.API/*.csproj Karalevha.API/
RUN dotnet restore Karalevha.API/Karalevha.API.csproj
COPY Karalevha.API/ Karalevha.API/
RUN dotnet publish Karalevha.API/Karalevha.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Karalevha.API.dll"]
