import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  orders: defineTable({
    name: v.string(),
    storeKey: v.string(),
    code: v.string(),
    organizerName: v.string(),
    organizerToken: v.string(),
    deadline: v.optional(v.number()),
    status: v.union(v.literal("open"), v.literal("locked"), v.literal("placed")),
  })
    .index("by_code", ["code"])
    .index("by_organizer_token", ["organizerToken"]),

  items: defineTable({
    orderId: v.id("orders"),
    token: v.string(),
    addedBy: v.string(),
    productId: v.string(),
    productName: v.string(),
    brand: v.string(),
    category: v.string(),
    size: v.string(),
    price: v.number(),
    image: v.string(),
    qty: v.number(),
    note: v.optional(v.string()),
    configurationKey: v.optional(v.string()),
    configuration: v.optional(
      v.object({
        modifierSize: v.optional(
          v.object({
            id: v.string(),
            label: v.string(),
            price: v.number(),
          }),
        ),
        selections: v.array(
          v.object({
            groupId: v.string(),
            groupLabel: v.string(),
            optionId: v.string(),
            optionLabel: v.string(),
            price: v.number(),
            quantity: v.number(),
          }),
        ),
      }),
    ),
    // Added via "Surprise me": identity hidden from everyone but the organizer.
    surprise: v.optional(v.boolean()),
  })
    .index("by_order", ["orderId"])
    .index("by_order_token_product", ["orderId", "token", "productId"])
    .index("by_order_token_product_and_configuration", [
      "orderId",
      "token",
      "productId",
      "configurationKey",
    ]),
});
