import mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
  collection: "orders",
  timestamps: true,
};

const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: false,
    },

    cartId: {
      type: Schema.Types.ObjectId,
      ref: "cart",
      required: true,
    },

    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "product", required: false },
        inventoryId: { type: Schema.Types.ObjectId, ref: "inventory", required: false },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        colors: { type: [String], required: true },
        sizes: { type: [String], required: true },
        totalAmount: { type: Number, default: 0 },
      },
    ],

    subtotal: { type: Number, required: false },
    tax: { type: String, default: "27AAACI1234F1Z2" },
    shippingCharges: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: false }, // subtotal + tax + shipping - discount

    deliveryAddress: {
      street: { type: String, required: false },
      city: { type: String, required: false },
      state: { type: String, required: false },
      country: { type: String, required: false },
      postalCode: { type: String, required: false },
      address:{type: String, required: false},
      buildingName:{type: String, required: false}, 
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },

    paymentMode: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true,
    },

    orderStatus: {
      type: String,
      enum: ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "PROCESSING",
    },

    trackingId: { type: String }, // Optional shipment tracking
  },
  options
);

orderSchema.plugin(mongoosePaginate);
orderSchema.plugin(mongooseAggregatePaginate);
module.exports = mongoose.model("order", orderSchema);

