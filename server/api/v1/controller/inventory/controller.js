import Joi from "joi";
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import productModel from "../../../../models/productModel";
import wareHouseModel from "../../../../models/wareHouseModel";
import inventoryModel from "../../../../models/invetoryModel";
import responseMessage from "../../../../../assets/responseMessage";

export class inventoryController {
    /**
     * @swagger
     * /inventory/createInventory:
     *   post:
     *     summary: Create a new inventory record
     *     tags:
     *       - INVENTORY
     *     description: Creates an inventory record tied to a specific product and warehouse.
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
     *         description: Inventory details
     *         schema:
     *           type: object
     *           required:
     *             - productId
     *             - warehouseId
     *             - colors
     *             - sizes
     *           properties:
     *             productId:
     *               type: string
     *             warehouseId:
     *               type: string
     *             colors:
     *               type: array
     *               items:
     *                 type: string
     *             sizes:
     *               type: array
     *               items:
     *                 type: string
     *             brand:
     *               type: string
     *             stockAvailable:
     *               type: number
     *             stockReserved:
     *               type: number
     *             stockDamaged:
     *               type: number
     *             stockInTransit:
     *               type: number
     *             status:
     *               type: string
     *               enum: [ACTIVE, INACTIVE, OUT_OF_STOCK]
     *             images:
     *               type: array
     *               items:
     *                 type: string
     *     responses:
     *       200:
     *         description: Inventory successfully created
     *       400:
     *         description: Validation error or bad request
     *       401:
     *         description: Unauthorized (Invalid or missing token)
     *       404:
     *         description: Product or Warehouse not found
     *       500:
     *         description: Internal server error
     */

   async createInventory(req, res, next) {
        const validationSchema = Joi.object({
            productId: Joi.string().required(),
            warehouseId: Joi.string().required(),
            colors: Joi.array().items(Joi.string()).min(1).required(),
            sizes: Joi.array().items(Joi.string()).min(1).required(),
            brand: Joi.string().optional(),
            stockAvailable: Joi.number().optional(),
            stockReserved: Joi.number().optional(),
            stockDamaged: Joi.number().optional(),
            stockInTransit: Joi.number().optional(),
            status: Joi.string().valid("ACTIVE", "INACTIVE", "OUT_OF_STOCK").optional(),
            images: Joi.array().items(Joi.string()).optional(),
        });

        try {
            const validatedBody = await validationSchema.validateAsync(req.body);
            const { productId, warehouseId, colors, sizes, brand, stockAvailable = 0, stockReserved = 0, stockDamaged = 0, stockInTransit = 0, status: inventoryStatus = "ACTIVE", images = [] } = validatedBody;

            // Check admin user
            const adminUser = await userModel.findOne({
                _id: req.userId,
                status: { $ne: status.DELETE },
                userType: userType.ADMIN,
            });
            if (!adminUser) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

            // Check existing inventory
            const existingInventory = await inventoryModel.findOne({ productId, warehouseId });
            if (existingInventory) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: "Inventory already exists for this product and warehouse.",
                });
            }

            // Fetch product
            const productData = await productModel.findOne({ _id: productId, status: status.ACTIVE });
            if (!productData) throw apiError.notFound(responseMessage.PRODUCT_NOT_FOUND);

            // Stock validation
            const productStock = productData.stock || 0;
            if (stockAvailable > productStock) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Stock available cannot exceed product stock (${productStock})`,
                });
            }

            // Strict colors validation
            const productColorsSet = new Set(productData.colors || []);
            const inventoryColorsSet = new Set(colors);
            if (productColorsSet.size !== inventoryColorsSet.size || [...productColorsSet].some(c => !inventoryColorsSet.has(c))) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Inventory colors must exactly match product colors: ${(productData.colors || []).join(", ")}`,
                });
            }

            // Strict sizes validation
            const productSizesSet = new Set(productData.sizes || []);
            const inventorySizesSet = new Set(sizes);
            if (productSizesSet.size !== inventorySizesSet.size || [...productSizesSet].some(s => !inventorySizesSet.has(s))) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Inventory sizes must exactly match product sizes: ${(productData.sizes || []).join(", ")}`,
                });
            }

            // Fetch warehouse
            const warehouseData = await wareHouseModel.findOne({ _id: warehouseId, status: { $ne: status.DELETE } });
            if (!warehouseData) throw apiError.notFound(responseMessage.WAREHOUSE_NOT_FOUND);

            // Check warehouse stock
            const updatedTotalStock = (warehouseData.totalStock || 0) - stockAvailable;
            if (updatedTotalStock < 0) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Warehouse does not have enough total stock to allocate (${warehouseData.totalStock})`,
                });
            }

            // Update product and warehouse stock
            await productModel.findByIdAndUpdate(productId, { stock: productStock - stockAvailable }, { new: true });
            await wareHouseModel.findByIdAndUpdate(warehouseId, { totalStock: updatedTotalStock }, { new: true });

            // Create inventory
            const inventoryData = await inventoryModel.create({
                productId,
                warehouseId,
                colors,
                sizes,
                brand,
                stockAvailable,
                stockReserved,
                stockDamaged,
                stockInTransit,
                status: inventoryStatus,
                images,
            });

            return res.status(200).json({
                responseCode: 200,
                responseMessage: responseMessage.INVENTORY_CREATED,
                data: inventoryData,
            });
        } catch (error) {
            console.error("createInventory error:", error);
            return next(error);
        }
    }
}

export default new inventoryController();
