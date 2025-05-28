//v7 imports
import admin from "./api/v1/controller/admin/routes.js";
import user from "./api/v1/controller/user/routes.js";
import product from "./api/v1/controller/product/routes.js";
import warehouse from "./api/v1/controller/warehouse/routes.js"; 
import inventory from "./api/v1/controller/inventory/routes.js";
import cart from "./api/v1/controller/cart/routes.js";
import order from "./api/v1/controller/orders/routes.js";
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
    app.use("/api/v1/warehouse", warehouse);
    app.use("/api/v1/inventory", inventory);
    app.use("/api/v1/cart", cart);
    app.use("/api/v1/order", order);

    return app;
}
