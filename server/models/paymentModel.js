import mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
    collection: "payment",
    timestamps: true,
};
const paymentSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: false,
        },
        orderId:{
            type: Schema.Types.ObjectId,
            ref: "order",
            required: false,
        },
        cartId: {
            type: Schema.Types.ObjectId,
            ref: "cart",
            required: false,
        },

        paymentStatus: {
            type: String,
            enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
            default: "PENDING",
        },

        paymentMode: {
            type: String,
            enum: ["COD", "ONLINE"],
            required: false,
        },
        orderStatus: {
            type: String,
            enum: ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "CONFIRMED"],
            default: "PROCESSING",
        },
        razorpay_signature: {type: String},
        razorpayOrderId: {type: String},
        razorpayPaymentId: {type: String},
    },
    options
);

paymentSchema.plugin(mongoosePaginate);
paymentSchema.plugin(mongooseAggregatePaginate);
module.exports = mongoose.model("payment", paymentSchema);
