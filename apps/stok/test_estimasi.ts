import 'dotenv/config';
import { fetchEstimasiRecipes } from './src/app/actions/estimasi_produksi';

async function run() {
  const recipes = await fetchEstimasiRecipes('f76dcb8c-c6f3-4246-86db-38fc718227b6');
  console.log(JSON.stringify(recipes, null, 2));
}

run().catch(console.error);
