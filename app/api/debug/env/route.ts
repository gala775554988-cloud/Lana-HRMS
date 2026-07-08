import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    ODOO_URL: Boolean(process.env.ODOO_URL),
    ODOO_DATABASE: Boolean(process.env.ODOO_DATABASE),
    ODOO_USERNAME: Boolean(process.env.ODOO_USERNAME),
    ODOO_PASSWORD: Boolean(process.env.ODOO_PASSWORD),
    ODOO_API_KEY: Boolean(process.env.ODOO_API_KEY),
    NODE_ENV: process.env.NODE_ENV
  });
}
