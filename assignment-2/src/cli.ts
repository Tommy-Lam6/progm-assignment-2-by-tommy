import { main } from "./processor";

try {
  main(process.argv)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} catch (error) {
  console.error(error);
  process.exit(1);
}
