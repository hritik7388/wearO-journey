import Express from 'express';
import controller from "./controller";
import auth from "../../../../helper/auth";
import upload from "../../../../helper/uploadHandler";
export default Express.Router()


.use(auth.verifyToken)
.use(upload.uploadFile)
.post('/createInventory', controller.createInventory)