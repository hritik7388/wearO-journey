import Mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
    collection: "cart",
    timestamps: true,
};
const cartSchema = new Schema(
    {
        userId: {type: Schema.Types.ObjectId, ref: "user", required: true},
        items: [
            {
                productId: {type: Schema.Types.ObjectId, ref: "product", required: true},
                inventoryId: {type: Schema.Types.ObjectId, ref: "inventory", required: true},
                 productName: { type: String, required: true }, // Name of the product
                quantity: {type: Number, required: true, min: 1},
                price: {type: Number, required: true}, // Price at the time of adding to cart
                colors: {type: [String], required: true}, // Changed to array
                sizes: {type: [String], required: true},
                totalAmount: {type: Number, default: 0},
            },
        ],
        subtotal: {type: Number, default: 0}, // Total amount for all items in the cart
        status: {
            type: String,
            enum: ["ACTIVE", "CHECKED_OUT", "CANCELLED"],
            default: "ACTIVE",
        },
    },
    options
);
cartSchema.plugin(mongoosePaginate);
cartSchema.plugin(mongooseAggregatePaginate);
module.exports = Mongoose.model("cart", cartSchema);
