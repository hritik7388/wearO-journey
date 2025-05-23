//v7 imports
import admin from "./api/v1/controller/admin/routes.js";
import user from "./api/v1/controller/user/routes.js";
import product from "./api/v1/controller/product/routes.js";

/**
 *
 *
 * @export
 * @param {any} app
 */

export default function routes(app) {
    app.use("/api/v1/user", user);
    app.use("/api/v1/admin", admin);
    app.use("/api/v1/product", product);

    return app;
}
