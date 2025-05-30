import express from "express";
import Mongoose from "mongoose";
import * as http from "http";
import * as path from "path";
import cors from "cors";
import morgan from "morgan";
import socket from "socket.io";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import apiErrorHandler from "../helper/apiErrorHandler";
import dotenv from "dotenv";
import orderRoutes from '../routes';

dotenv.config();
const app = new express();
const server = http.createServer(app); 
app.use(express.json());
 
app.get('/index.html', (req, res) => {
  app.use(express.static(path.join(__dirname, 'frontend')));

});
 
const root = path.normalize(`${__dirname}/../..`);
class ExpressServer {
    constructor() {
        app.use(express.json({
            limit: "1000mb"
        }));
        // app.use('/api/v1/order', orderRoutes);


        app.use(express.urlencoded({
            extended: true,
            limit: "1000mb"
        }));

        app.use(morgan("dev"));

        app.use(
            cors({
                allowedHeaders: ["Content-Type", "token", "authorization"],
                exposedHeaders: ["token", "authorization"],
                origin: "*",
                methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
                preflightContinue: false,
            })
        );
 
    }
    router(routes) {
        routes(app);
        return this;
    }

    configureSwagger(swaggerDefinition) {
        const options = {
            swaggerDefinition,
            apis: [
                path.resolve(`${root}/server/api/v1/controller/**/*.js`, ),
                path.resolve(`${root}/api.yaml`),
            ],

        };

        app.use(
            "/api-docs",
            swaggerUi.serve,
            swaggerUi.setup(swaggerJSDoc(options))
        );
        return this;
    }

    handleError() {
        app.use(apiErrorHandler);

        return this;
    }

  async configureDb(dbUrl) {
      try {
          await Mongoose.connect(dbUrl, {
              useNewUrlParser: true,
              useUnifiedTopology: true,
          });
          console.log("Connected to the database successfully");
      } catch (error) {
          console.error("Database connection error:", error);
          throw error;
      }
  }

    listen(port) {
        server.listen(port, () => {
            console.log(
                `secure app is listening 🌍 @port ${port}`,
                new Date().toLocaleString()
            );
        });
        return app;
    }

}

export default ExpressServer;