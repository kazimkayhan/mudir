import type Database from "@tauri-apps/plugin-sql";

/** Atomically adjust stock; throws if result would be negative. Returns new qty. */
export async function adjustProductStock(
  db: Database,
  productId: string,
  quantityDelta: number
): Promise<number> {
  if (quantityDelta < 0) {
    const result = await db.execute(
      `UPDATE products SET on_hand_qty = on_hand_qty + $1
       WHERE id = $2 AND on_hand_qty + $1 >= 0`,
      [quantityDelta, productId]
    );
    if (!result.rowsAffected) {
      throw new Error("validation.insufficientStock");
    }
  } else if (quantityDelta > 0) {
    await db.execute(
      "UPDATE products SET on_hand_qty = on_hand_qty + $1 WHERE id = $2",
      [quantityDelta, productId]
    );
  }
  const rows = await db.select<unknown>(
    "SELECT on_hand_qty FROM products WHERE id = $1",
    [productId]
  );
  const parsed = rows as { on_hand_qty: number }[];
  const row = parsed[0];
  if (!row) {
    throw new Error("Product not found");
  }
  return row.on_hand_qty;
}

export async function productHasReferences(
  db: Database,
  productId: string
): Promise<boolean> {
  const checks = [
    "SELECT 1 FROM sale_items WHERE product_id = $1 LIMIT 1",
    "SELECT 1 FROM purchase_lines WHERE product_id = $1 LIMIT 1",
    "SELECT 1 FROM online_order_items WHERE product_id = $1 LIMIT 1",
    "SELECT 1 FROM stock_movements WHERE product_id = $1 LIMIT 1",
  ];
  for (const sql of checks) {
    const rows = await db.select<unknown>(sql, [productId]);
    if (Array.isArray(rows) && rows.length > 0) {
      return true;
    }
  }
  return false;
}
