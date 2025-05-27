import Express from 'express';
import controller from "./controller";
import auth from "../../../../helper/auth";
import upload from "../../../../helper/uploadHandler";

export default Express.Router()

.use(auth.verifyToken)
.use(upload.uploadFile)
.post('/createProduct', controller.createProduct)
.put('/updateProduct', controller.updateProduct)
.get("/viewProduct", controller.viewProduct)
.get("/listProducts", controller.listProducts)