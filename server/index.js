import Config from "config";
import Routes from "./routes";
import Server from "./common/server";
(async () => {
  const dbUrl = `mongodb://${Config.get("databaseHost")}:${Config.get(
    "databasePort"
  )}/${Config.get("databaseName")}`;

  const server = new Server()
    .router(Routes)
    .configureSwagger(Config.get("swaggerDefinition"))
    .handleError();

  await server.configureDb(dbUrl); // Wait for DB connection

  server.listen(Config.get("port"));
})();