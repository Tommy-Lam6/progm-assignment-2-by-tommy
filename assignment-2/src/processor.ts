import * as fs from "fs"; // sync version
import * as fsPromises from "fs/promises"; // async version (Promise-based fs API)
import * as path from "path";
import { splitBill, BillInput, BillOutput } from "./core";

/**
 * 主程式入口點
 * @param args 命令列參數陣列
 * @description 解析命令列參數並執行相應的處理邏輯，支援單一檔案和批次處理模式
 */
export async function main(args: string[]): Promise<void> {
  // 解析命令行參數
  const parsedArgs = parseArgs(args);

  try {
    if (parsedArgs.input && parsedArgs.output) {
      // 檢查輸入是檔案還是目錄
      const inputStat = await fsPromises.stat(parsedArgs.input);

      if (inputStat.isDirectory()) {
        // 批次處理
        await processBatch(
          parsedArgs.input,
          parsedArgs.output,
          parsedArgs.format
        );
      } else {
        // 單一檔案處理
        await processFile(
          parsedArgs.input,
          parsedArgs.output,
          parsedArgs.format
        );
      }
    } else {
      throw new Error("Missing required parameters: --input and --output");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

/**
 * 解析命令行參數
 */
function parseArgs(args: string[]): {
  input?: string;
  output?: string;
  format?: string;
} {
  const result: { input?: string; output?: string; format?: string } = {};

  for (const arg of args) {
    if (arg.startsWith("--input=")) {
      result.input = arg.substring("--input=".length);
    } else if (arg.startsWith("--output=")) {
      result.output = arg.substring("--output=".length);
    } else if (arg.startsWith("--format=")) {
      result.format = arg.substring("--format=".length);
    }
  }

  // 預設格式為 json
  if (!result.format) {
    result.format = "json";
  }

  return result;
}

/**
 * 處理單一檔案
 */
async function processFile(
  inputPath: string,
  outputPath: string,
  format: string = "json"
): Promise<void> {
  // 讀取輸入檔案
  const inputData = await readJSONFile(inputPath);

  // 呼叫 core 函數處理數據
  const result = splitBill(inputData);

  // 寫入輸出檔案
  await writeFile(outputPath, result, format);
}

/**
 * 批次處理目錄中的所有 JSON 檔案
 */
async function processBatch(
  inputDir: string,
  outputDir: string,
  format: string = "json"
): Promise<void> {
  // 確保輸出目錄存在
  await fsPromises.mkdir(outputDir, { recursive: true });

  // 讀取輸入目錄中的所有檔案
  const files = await fsPromises.readdir(inputDir);

  // 篩選出 JSON 檔案
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  // 處理每個 JSON 檔案
  for (const file of jsonFiles) {
    const inputPath = path.join(inputDir, file);
    const outputFileName =
      format === "json" ? file : file.replace(".json", ".txt");
    const outputPath = path.join(outputDir, outputFileName);

    try {
      await processFile(inputPath, outputPath, format);
      console.log(`Processed: ${file} -> ${outputFileName}`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log(
    `Batch processing completed. Processed ${jsonFiles.length} files.`
  );
}

/**
 * 讀取 JSON 檔案
 */
async function readJSONFile(filePath: string): Promise<BillInput> {
  const content = await fsPromises.readFile(filePath, "utf-8");
  return JSON.parse(content) as BillInput;
}

/**
 * 寫入檔案
 */
async function writeFile(
  filePath: string,
  data: BillOutput,
  format: string
): Promise<void> {
  // 確保輸出目錄存在
  const outputDir = path.dirname(filePath);
  await fsPromises.mkdir(outputDir, { recursive: true });

  if (format === "json") {
    await fsPromises.writeFile(
      filePath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
  } else if (format === "text") {
    const textOutput = formatAsText(data);
    await fsPromises.writeFile(filePath, textOutput, "utf-8");
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * 格式化為文字輸出
 */
function formatAsText(data: BillOutput): string {
  let result = `日期: ${data.date}\n`;
  result += `地點: ${data.location}\n`;
  result += `小計: $${data.subTotal}\n`;
  result += `小費: $${data.tip}\n`;
  result += `總計: $${data.totalAmount}\n`;
  result += "\n分帳明細:\n";

  for (const item of data.items) {
    result += `  ${item.name}: $${item.amount}\n`;
  }

  return result;
}
