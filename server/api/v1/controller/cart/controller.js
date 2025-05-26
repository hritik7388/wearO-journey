const Joi = require("joi");
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import productModel from "../../../../models/productModel";
import wareHouseModel from "../../../../models/wareHouseModel";
import inventoryModel from "../../../../models/invetoryModel";
import responseMessage from "../../../../../assets/responseMessage";
import cartModel from "../../../../models/cartModel";

export class CartController {
/**
 * @swagger
 * /cart/addProductToCart:
 *   post:
 *     summary: Add product(s) to cart
 *     tags:
 *       - CART
 *     description: Adds product(s) to the user's cart. Price will be fetched automatically from inventory.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: token
 *         in: header
 *         required: true
 *         description: Bearer token for authentication
 *         type: string
 *       - in: body
 *         name: body
 *         required: true
 *         description: Cart item details
 *         schema:
 *           type: object
 *           required:
 *             - items
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *                 required:
 *                   - productId
 *                   - inventoryId
 *                   - quantity
 *                   - colors
 *                   - sizes
 *                 properties:
 *                   productId:
 *                     type: string
 *                   inventoryId:
 *                     type: string
 *                   quantity:
 *                     type: number
 *                   colors:
 *                     type: array
 *                     items:
 *                       type: string
 *                   sizes:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Cart successfully updated or created
 *       400:
 *         description: Validation error or out-of-stock
 *       404:
 *         description: Inventory not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

async addProductToCart(req, res, next) {
  const validationSchema = {
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.string().required(),
          inventoryId: Joi.string().required(),
          quantity: Joi.number().min(1).required(),
          colors: Joi.array().items(Joi.string()).required(),
          sizes: Joi.array().items(Joi.string()).required(),
        })
      )
      .min(1)
      .required(),
  };

  try {
    const validatedBody = await Joi.validate(req.body, validationSchema);

    const userData = await userModel.findOne({
      _id: req.userId,
      userType: userType.USER,
      status: { $ne: status.DELETE },
    });
    if (!userData) {
      throw apiError.notFound(responseMessage.USER_NOT_FOUND);
    }

const productData= await productModel.findOne({
      _id: validatedBody.items[0].productId,
      status: { $ne: status.DELETE },
    });
    if (!productData) {
      throw apiError.notFound(responseMessage.PRODUCT_NOT_FOUND);
    }
    const inventoryData = await inventoryModel.findOne({
      _id: validatedBody.items[0].inventoryId, 
      status: status.ACTIVE,
    });
    if (!inventoryData) {
      throw apiError.notFound(responseMessage.INVENTORY_NOT_FOUND);
    }
    if (inventoryData.stockAvailable < validatedBody.items[0].quantity) {
      throw apiError.badRequest(responseMessage.OUT_OF_STOCK);
    }
 
 
  } catch (error) {
    return next(error);
  }
}

}
export default new CartController();
