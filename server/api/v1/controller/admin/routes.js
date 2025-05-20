
import Express from 'express';
import controller from "./controller";
export default Express.Router()
.post('/login',controller.login)
