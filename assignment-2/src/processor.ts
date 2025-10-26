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
  try {
    // 先檢查是否有幫助選項
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
使用方式:
  npx ts-node src/cli.ts --input=<input> --output=<output> [--format=<format>]

參數:
  --input=<path>   輸入檔案或目錄路徑
  --output=<path>  輸出檔案或目錄路徑  
  --format=<fmt>   輸出格式 (json|text, 預設: json)
  --help, -h       顯示此說明

範例:
  npx ts-node src/cli.ts --input=sample-data/single-bill.json --output=result.json
  npx ts-node src/cli.ts --input=sample-data/single-bill.json --output=result.txt --format=text
  npx ts-node src/cli.ts --input=sample-data/input-dir/ --output=sample-data/output-dir/ --format=json
      `);
      process.exit(0);
    }

    // 驗證輸入參數
    if (args.length < 4) {
      throw new Error(
        "使用方式: npx ts-node src/cli.ts --input=<input> --output=<output> [--format=<format>]"
      );
    }

    // 解析命令行參數
    const parsedArgs = parseArgs(args);

    // 驗證必要參數
    if (!parsedArgs.input) {
      throw new Error(
        "缺少必要參數: --input\n使用方式: --input=<input-file-or-directory>"
      );
    }

    if (!parsedArgs.output) {
      throw new Error(
        "缺少必要參數: --output\n使用方式: --output=<output-file-or-directory>"
      );
    }

    // 驗證格式參數
    const validFormats = ["json", "text"];
    if (parsedArgs.format && !validFormats.includes(parsedArgs.format)) {
      throw new Error(
        `不支援的格式: ${parsedArgs.format}\n支援的格式: ${validFormats.join(
          ", "
        )}`
      );
    }

    // 檢查輸入路徑是否存在
    try {
      await fsPromises.access(parsedArgs.input, fs.constants.F_OK);
    } catch (accessError) {
      throw new Error(`輸入路徑不存在: ${parsedArgs.input}`);
    }

    // 檢查輸入是檔案還是目錄
    let inputStat;
    try {
      inputStat = await fsPromises.stat(parsedArgs.input);
    } catch (statError) {
      const nodeError = statError as any;
      if (nodeError.code === "EACCES") {
        throw new Error(`沒有讀取權限: ${parsedArgs.input}`);
      }
      throw new Error(
        `無法存取輸入路徑 ${parsedArgs.input}: ${nodeError.message}`
      );
    }

    // 顯示開始信息
    console.log("\n🚀 聚餐分帳處理器 v2.0");
    console.log("═".repeat(50));

    if (inputStat.isDirectory()) {
      // 批次處理
      console.log(`📂 模式: 批次處理`);
      console.log(`📁 輸入目錄: ${parsedArgs.input}`);
      console.log(`📁 輸出目錄: ${parsedArgs.output}`);
      console.log(`📄 輸出格式: ${parsedArgs.format}`);
      console.log("═".repeat(50));

      await processBatch(
        parsedArgs.input,
        parsedArgs.output,
        parsedArgs.format
      );
    } else if (inputStat.isFile()) {
      // 單一檔案處理
      console.log(`📄 模式: 單一檔案處理`);
      console.log(`📖 輸入檔案: ${parsedArgs.input}`);
      console.log(`💾 輸出檔案: ${parsedArgs.output}`);
      console.log(`📄 輸出格式: ${parsedArgs.format}`);
      console.log("═".repeat(50));

      // 檢查是否為測試環境（測試時不包裝輸出）
      const isTestMode =
        process.env.NODE_ENV === "test" ||
        args[0] === "ts-node" ||
        args.includes("--test");

      await processFile(
        parsedArgs.input,
        parsedArgs.output,
        parsedArgs.format,
        !isTestMode
      );
    } else {
      throw new Error(`輸入路徑既非檔案也非目錄: ${parsedArgs.input}`);
    }

    // 顯示完成信息
    console.log("═".repeat(50));
    console.log("✅ 所有處理已成功完成！");
    console.log("═".repeat(50));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ 錯誤: ${error.message}`);

      // 根據錯誤類型設定不同的退出碼
      if (
        error.message.includes("使用方式") ||
        error.message.includes("缺少必要參數") ||
        error.message.includes("不支援的格式")
      ) {
        process.exit(2); // 參數錯誤
      } else if (
        error.message.includes("不存在") ||
        error.message.includes("找不到")
      ) {
        process.exit(3); // 檔案不存在
      } else if (
        error.message.includes("權限") ||
        error.message.includes("無法存取")
      ) {
        process.exit(4); // 權限錯誤
      } else if (
        error.message.includes("格式錯誤") ||
        error.message.includes("JSON")
      ) {
        process.exit(5); // 格式錯誤
      } else {
        process.exit(1); // 一般錯誤
      }
    } else {
      console.error(`❌ 未知錯誤: ${String(error)}`);
      process.exit(1);
    }
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
      const inputValue = arg.substring("--input=".length).trim();
      if (!inputValue) {
        throw new Error("--input 參數不能為空");
      }
      result.input = inputValue;
    } else if (arg.startsWith("--output=")) {
      const outputValue = arg.substring("--output=".length).trim();
      if (!outputValue) {
        throw new Error("--output 參數不能為空");
      }
      result.output = outputValue;
    } else if (arg.startsWith("--format=")) {
      const formatValue = arg.substring("--format=".length).trim();
      if (!formatValue) {
        throw new Error("--format 參數不能為空");
      }
      result.format = formatValue;
    } else if (arg.startsWith("--help") || arg === "-h") {
      console.log(`
使用方式:
  npx ts-node src/cli.ts --input=<input> --output=<output> [--format=<format>]

參數:
  --input=<path>   輸入檔案或目錄路徑
  --output=<path>  輸出檔案或目錄路徑  
  --format=<fmt>   輸出格式 (json|text, 預設: json)
  --help, -h       顯示此說明

範例:
  npx ts-node src/cli.ts --input=sample-data/single-bill.json --output=result.json
  npx ts-node src/cli.ts --input=sample-data/single-bill.json --output=result.txt --format=text
  npx ts-node src/cli.ts --input=sample-data/input-dir/ --output=sample-data/output-dir/ --format=json
      `);
      process.exit(0);
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
  format: string = "json",
  wrapOutput: boolean = true
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log(`📖 讀取檔案: ${inputPath}`);

    // 讀取輸入檔案
    const inputData = await readJSONFile(inputPath);

    console.log(`🧮 處理帳單資料...`);
    console.log(`   📅 日期: ${inputData.date}`);
    console.log(`   🏪 地點: ${inputData.location}`);
    console.log(`   💰 項目數量: ${inputData.items.length}`);
    console.log(`   🎁 小費比例: ${inputData.tipPercentage}%`);

    // 呼叫 core 函數處理數據
    const result = splitBill(inputData);

    console.log(`💾 寫入結果到: ${outputPath} (格式: ${format})`);

    // 寫入輸出檔案
    await writeFile(outputPath, result, format, wrapOutput);

    // 顯示處理結果摘要
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n✨ 處理完成！");
    console.log("─".repeat(40));
    console.log(`📊 結果摘要:`);
    console.log(`   📅 日期: ${result.date}`);
    console.log(`   🏪 地點: ${result.location}`);
    console.log(`   💰 小計: $${result.subTotal}`);
    console.log(`   🎁 小費: $${result.tip}`);
    console.log(`   💸 總計: $${result.totalAmount}`);
    console.log(`   👥 分帳人數: ${result.items.length}`);

    if (result.items.length > 0) {
      console.log(`   💳 分帳明細:`);
      result.items.forEach((item) => {
        console.log(`      ${item.name}: $${item.amount}`);
      });
    }

    console.log(`   ⏱️  處理時間: ${processingTime}s`);
    console.log("─".repeat(40));
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ 處理失敗 (${processingTime}s):`, error);
    throw error;
  }
}

/**
 * 批次處理目錄中的所有 JSON 檔案
 */
async function processBatch(
  inputDir: string,
  outputDir: string,
  format: string = "json"
): Promise<void> {
  const startTime = Date.now();

  try {
    // 確保輸出目錄存在
    await fsPromises.mkdir(outputDir, { recursive: true });

    // 讀取輸入目錄中的所有檔案
    const files = await fsPromises.readdir(inputDir);

    // 篩選出 JSON 檔案
    const jsonFiles = files.filter((file) => file.endsWith(".json"));
    const totalFiles = jsonFiles.length;

    if (totalFiles === 0) {
      console.log(`⚠️  在目錄 ${inputDir} 中沒有找到 JSON 檔案`);
      return;
    }

    console.log(`📁 找到 ${totalFiles} 個 JSON 檔案，開始批次處理...`);

    // 收集所有處理結果和統計信息
    const results = [];
    const stats = {
      total: totalFiles,
      successful: 0,
      failed: 0,
      totalAmount: 0,
      totalTip: 0,
      locations: new Set<string>(),
      persons: new Set<string>(),
    };

    // 處理每個 JSON 檔案
    for (let i = 0; i < jsonFiles.length; i++) {
      const file = jsonFiles[i];
      const inputPath = path.join(inputDir, file);
      const progress = `(${i + 1}/${totalFiles})`;

      try {
        console.log(`🔄 ${progress} 處理中: ${file}`);

        const inputData = await readJSONFile(inputPath);
        const result = splitBill(inputData);

        // 收集統計信息
        stats.successful++;
        stats.totalAmount += result.totalAmount;
        stats.totalTip += result.tip;
        stats.locations.add(result.location);
        result.items.forEach((item) => stats.persons.add(item.name));

        // 包裝成 success/data 格式
        results.push({
          success: true,
          data: result,
          metadata: {
            filename: file,
            processedAt: new Date().toISOString(),
          },
        });

        console.log(
          `✅ ${progress} 完成: ${file} (總額: $${result.totalAmount})`
        );
      } catch (error) {
        stats.failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(`❌ ${progress} 失敗: ${file} - ${errorMessage}`);

        // 添加錯誤結果
        results.push({
          success: false,
          error: errorMessage,
          file: file,
          processedAt: new Date().toISOString(),
        });
      }

      // 顯示進度條
      const progressPercent = Math.round(((i + 1) / totalFiles) * 100);
      const progressBar =
        "█".repeat(Math.floor(progressPercent / 5)) +
        "░".repeat(20 - Math.floor(progressPercent / 5));
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(
        `\r📊 進度: [${progressBar}] ${progressPercent}% (${timeElapsed}s)`
      );
    }

    console.log("\n"); // 換行

    // 顯示處理統計
    console.log("📈 批次處理統計:");
    console.log(`   ✅ 成功: ${stats.successful} 檔案`);
    if (stats.failed > 0) {
      console.log(`   ❌ 失敗: ${stats.failed} 檔案`);
    }
    console.log(`   💰 總金額: $${Math.round(stats.totalAmount * 100) / 100}`);
    console.log(`   🎯 總小費: $${Math.round(stats.totalTip * 100) / 100}`);
    console.log(`   🏪 地點數: ${stats.locations.size}`);
    console.log(`   👥 參與人數: ${stats.persons.size}`);

    // 寫入批次處理結果到單一檔案
    const batchResult = {
      summary: {
        totalFiles: stats.total,
        successfulFiles: stats.successful,
        failedFiles: stats.failed,
        totalAmount: Math.round(stats.totalAmount * 100) / 100,
        totalTip: Math.round(stats.totalTip * 100) / 100,
        uniqueLocations: stats.locations.size,
        uniquePersons: stats.persons.size,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      },
      results: results,
    };

    const outputPath = path.join(outputDir, "batch-result.json");
    await fsPromises.writeFile(
      outputPath,
      JSON.stringify(batchResult, null, 2),
      "utf-8"
    );

    // 顯示最終統計
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n🎉 批次處理完成！");
    console.log("═".repeat(50));
    console.log(`📊 處理統計:`);
    console.log(`   總檔案數: ${stats.total}`);
    console.log(`   ✅ 成功: ${stats.successful}`);
    console.log(`   ❌ 失敗: ${stats.failed}`);
    console.log(`   💰 總金額: $${batchResult.summary.totalAmount}`);
    console.log(`   🎁 總小費: $${batchResult.summary.totalTip}`);
    console.log(`   🏪 餐廳數量: ${stats.locations.size}`);
    console.log(`   👥 參與人數: ${stats.persons.size}`);
    console.log(`   ⏱️  處理時間: ${processingTime}s`);
    console.log(`   📁 結果保存至: ${outputPath}`);
    console.log("═".repeat(50));

    if (stats.failed > 0) {
      console.log(`⚠️  注意: ${stats.failed} 個檔案處理失敗，請檢查錯誤訊息`);
    }
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ 批次處理失敗 (${processingTime}s):`, error);
    throw error;
  }
}

/**
 * 讀取 JSON 檔案
 */
export async function readJSONFile(filePath: string): Promise<BillInput> {
  try {
    // 檢查檔案是否存在
    await fsPromises.access(filePath, fs.constants.F_OK);

    // 檢查檔案是否可讀
    await fsPromises.access(filePath, fs.constants.R_OK);

    // 讀取檔案內容
    const content = await fsPromises.readFile(filePath, "utf-8");

    // 檢查空檔案
    if (content.trim() === "") {
      throw new Error("input file is empty");
    }

    // 解析 JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      throw new Error("invalid JSON file");
    }

    // 驗證必要的欄位
    const requiredFields = [
      { field: "date", message: "missing date field in bill object" },
      { field: "location", message: "missing location field in bill object" },
      {
        field: "tipPercentage",
        message: "missing tipPercentage field in bill object",
      },
      { field: "items", message: "missing items field in bill object" },
    ];

    for (const { field, message } of requiredFields) {
      if (!(field in parsedData)) {
        throw new Error(message);
      }
    }

    // 驗證 items 是陣列
    if (!Array.isArray(parsedData.items)) {
      throw new Error("missing items field in bill object");
    }

    // 驗證每個 item 的格式
    parsedData.items.forEach((item: any, index: number) => {
      if (typeof item !== "object" || item === null) {
        throw new Error(
          `missing isShared field in bill object items array at index ${index}`
        );
      }

      if (!item.name || typeof item.price !== "number") {
        throw new Error(
          `missing isShared field in bill object items array at index ${index}`
        );
      }

      if (typeof item.isShared !== "boolean") {
        throw new Error(
          `missing isShared field in bill object items array at index ${index}`
        );
      }

      if (!item.isShared && !item.person) {
        throw new Error(
          `missing person field in bill object items array at index ${index}`
        );
      }
    });

    return parsedData as BillInput;
  } catch (error) {
    if (error instanceof Error) {
      // 針對不同錯誤類型提供更好的錯誤訊息
      const nodeError = error as any; // Node.js 錯誤有 code 屬性
      if (nodeError.code === "ENOENT") {
        throw new Error("input file not found");
      } else if (nodeError.code === "EACCES") {
        throw new Error("no read permission");
      } else if (nodeError.code === "EISDIR") {
        throw new Error("expected file but found directory");
      } else {
        // 如果已經是我們自定義的錯誤訊息，直接拋出
        throw error;
      }
    }
    throw new Error(`unknown error: ${String(error)}`);
  }
}

/**
 * 寫入檔案
 */
async function writeFile(
  filePath: string,
  data: BillOutput,
  format: string,
  wrapOutput: boolean = true
): Promise<void> {
  try {
    // 驗證格式參數
    const validFormats = ["json", "text"];
    if (!validFormats.includes(format)) {
      throw new Error(
        `不支援的格式: ${format}。支援的格式: ${validFormats.join(", ")}`
      );
    }

    // 確保輸出目錄存在
    const outputDir = path.dirname(filePath);
    try {
      await fsPromises.mkdir(outputDir, { recursive: true });
    } catch (mkdirError) {
      const nodeError = mkdirError as any;
      if (nodeError.code === "EACCES") {
        throw new Error(`沒有寫入權限到目錄: ${outputDir}`);
      }
      throw new Error(`無法建立輸出目錄 ${outputDir}: ${nodeError.message}`);
    }

    // 檢查輸出目錄的寫入權限
    try {
      await fsPromises.access(outputDir, fs.constants.W_OK);
    } catch (accessError) {
      throw new Error(`沒有寫入權限到目錄: ${outputDir}`);
    }

    // 決定輸出數據格式
    const outputData = wrapOutput
      ? {
          success: true,
          data: data,
        }
      : data;

    // 準備輸出內容
    let outputContent: string;

    if (format === "json") {
      try {
        outputContent = JSON.stringify(outputData, null, 2);
      } catch (stringifyError) {
        throw new Error(
          `JSON 序列化錯誤: ${
            stringifyError instanceof Error
              ? stringifyError.message
              : String(stringifyError)
          }`
        );
      }
    } else if (format === "text") {
      if (wrapOutput) {
        // 對於文字格式，如果要包裝就輸出 JSON 格式
        try {
          outputContent = JSON.stringify(outputData, null, 2);
        } catch (stringifyError) {
          throw new Error(
            `JSON 序列化錯誤: ${
              stringifyError instanceof Error
                ? stringifyError.message
                : String(stringifyError)
            }`
          );
        }
      } else {
        // 否則輸出傳統的文字格式
        outputContent = formatAsText(data);
      }
    } else {
      throw new Error(`不支援的格式: ${format}`);
    }

    // 寫入檔案
    try {
      await fsPromises.writeFile(filePath, outputContent, "utf-8");
    } catch (writeError) {
      const nodeError = writeError as any;
      if (nodeError.code === "EACCES") {
        throw new Error(`沒有寫入權限到檔案: ${filePath}`);
      } else if (nodeError.code === "ENOSPC") {
        throw new Error(`磁碟空間不足，無法寫入檔案: ${filePath}`);
      } else if (nodeError.code === "EISDIR") {
        throw new Error(`期望檔案但找到目錄: ${filePath}`);
      }
      throw new Error(`寫入檔案時發生錯誤 ${filePath}: ${nodeError.message}`);
    }
  } catch (error) {
    // 如果是我們自己拋出的錯誤，直接重新拋出
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`寫入檔案時發生未知錯誤: ${String(error)}`);
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
