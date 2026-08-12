import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Use .env to get the supabase url and key
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Find a company to assign the order to
  const { data: companies } = await supabase.from("companies").select("name").limit(1);
  const companyName = companies && companies.length > 0 ? companies[0].name : "Empresa Teste";

  const order = {
    company: companyName,
    client_name: "Cliente Teste",
    client_phone: "11999999999",
    items: [
      { name: "Pizza Calabresa", quantity: 1, price: 45.00 },
      { name: "Coca-Cola 2L", quantity: 1, price: 12.00 }
    ],
    observations: "Sem cebola",
    delivery_address: "Rua Teste, 123 - Centro",
    payment_approved: false,
    total_value: 57.00,
    status: "Novos"
  };

  const { data, error } = await supabase.from("delivery_orders").insert([order]).select();
  if (error) {
    console.error("Error inserting order:", error);
  } else {
    console.log("Successfully inserted order:", data);
  }
}

run();
