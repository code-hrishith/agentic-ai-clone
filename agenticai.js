import dotenv from "dotenv";
import { OpenAI } from "openai";
import axios from "axios";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

dotenv.config();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const targetDir = "/Users/hrishithsavir/Desktop/genai/file";

async function fetchAssets(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0" });

  // Full rendered HTML
  const html = await page.content();

  // // Grab all assets
  // const assets = await page.evaluate(() => {
  //   const urls = [];
  //   document
  //     .querySelectorAll("link[href], script[src], img[src]")
  //     .forEach((el) => {
  //       urls.push(el.href || el.src);
  //     });
  //   return urls;
  // });

  await browser.close();

  await saveAndRewriteHTML(html, url);

  return { html };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function saveFile(filename, content) {// saving downloaded content in correct subfolder/directory
  if (!content) {
    throw new Error(`❌ Tried saving ${filename} but content is undefined`);
  }

  // Detect subfolder by extension
  const ext = path.extname(filename).toLowerCase();
  let subfolder = "misc";
  if ([".css"].includes(ext)) subfolder = "css";
  else if ([".js"].includes(ext)) subfolder = "js";
  else if (
    [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"].includes(ext)
  )
    subfolder = "images";
  else if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext))
    subfolder = "fonts";
  else if ([".html", ".htm"].includes(ext)) subfolder = "html";

  // Create subfolder
  const folder = path.join(targetDir, subfolder);
  await fs.promises.mkdir(folder, { recursive: true });

  // Pick encoding
  const encoding = [".html", ".htm", ".css", ".js"].includes(ext)
    ? "utf-8"
    : undefined;

  // Save file
  const filePath = path.join(folder, filename);
  await fs.promises.writeFile(filePath, content, encoding);

  console.log(`✅ Saved ${filename} -> ${filePath}`);
  return filePath;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// async function downloadAsset(url) { // downloading assets like images etc from websites
//   try {
//     const res = await axios.get(url, { responseType: "arraybuffer" });
//     const filename = path.basename(new URL(url).pathname.split("?")[0]) || "file";
//     const ext = path.extname(filename).toLowerCase();

//     let subfolder = "misc";
//     if ([".css"].includes(ext)) subfolder = "css";
//     else if ([".js"].includes(ext)) subfolder = "js";
//     else if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"].includes(ext)) subfolder = "images";

//     const folder = path.join(targetDir, subfolder);
//     await fs.promises.mkdir(folder, { recursive: true });
//     const filePath = path.join(folder, filename);

//     await fs.promises.writeFile(filePath, res.data);
//     console.log(`✅ Saved asset: ${url} -> ${filePath}`);
//     return `./${subfolder}/${filename}`;
//   } catch (err) {
//     console.error(`❌ Failed to download asset ${url}: ${err.message}`);
//     return null;
//   }
// }

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function downloadAndSave(url) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer" });

    // Extract clean filename from URL (remove query params/fragments)
    let filename = path.basename(new URL(url).pathname.split("?")[0]);

    // Default to index.html if empty (like trailing slash URLs)
    if (!filename || filename === "/" || filename.trim() === "") {
      filename = "index.html";
    }

    // Detect extension
    const ext = path.extname(filename).toLowerCase();

    // Decide subfolder based on extension
    let subfolder = "misc";
    if ([".css"].includes(ext)) subfolder = "css";
    else if ([".js"].includes(ext)) subfolder = "js";
    else if (
      [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"].includes(ext)
    )
      subfolder = "images";
    else if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext))
      subfolder = "fonts";
    else if ([".html", ".htm"].includes(ext)) subfolder = "html";

    // Create subfolder under targetDir
    const saveDir = path.join(targetDir, subfolder);
    await fs.promises.mkdir(saveDir, { recursive: true });

    // Final file path
    const filePath = path.join(saveDir, filename);

    await fs.promises.writeFile(filePath, res.data);
    console.log(`✅ Saved ${url} -> ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed to download ${url}: ${err.message}`);
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function saveAndRewriteHTML(html, baseUrl) { //rewrite html content
  try {
    const $ = cheerio.load(html);

    // Function to rewrite a single tag attribute (like src or href)
    const rewriteAttr = (selector, attr) => {
      $(selector).each((_, el) => {
        const oldUrl = $(el).attr(attr);
        if (!oldUrl || oldUrl.startsWith("data:")) return; // skip empty/data URIs

        // Handle relative vs absolute URLs
        const absUrl = new URL(oldUrl, baseUrl).href;

        // Extract filename + extension
        let filename = path.basename(new URL(absUrl).pathname.split("?")[0]);
        if (!filename || filename === "/") filename = "index.html";

        const ext = path.extname(filename).toLowerCase();

        let subfolder = "misc";
        if ([".css"].includes(ext)) subfolder = "css";
        else if ([".js"].includes(ext)) subfolder = "js";
        else if (
          [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"].includes(
            ext
          )
        )
          subfolder = "images";
        else if ([".woff", ".woff2", ".ttf", ".otf", ".eot"].includes(ext))
          subfolder = "fonts";
        else if ([".html", ".htm"].includes(ext)) subfolder = "html";

        // Update attribute to point to local file
        $(el).attr(attr, `./${subfolder}/${filename}`);

        // Trigger download
        downloadAndSave(absUrl);
      });
    };

    // Rewrite assets
    rewriteAttr("link[href]", "href");
    rewriteAttr("script[src]", "src");
    rewriteAttr("img[src]", "src");

    // Save rewritten HTML
    const saveDir = path.join(targetDir, "html");
    await fs.promises.mkdir(saveDir, { recursive: true });
    const filePath = path.join(saveDir, "index.html");

    await fs.promises.writeFile(filePath, $.html(), "utf-8");
    console.log(`✅ HTML rewritten and saved -> ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed to rewrite HTML: ${err.message}`);
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////









const TOOL_MAP = {
  fetchAssets: fetchAssets,
  saveFile: saveFile,
  downloadAndSave: downloadAndSave,
};

const openai = new OpenAI({
  apiKey: process.env.APIKEY_GPT,
});

async function main() {
  // These api calls are stateless (Chain Of Thought)
  const SYSTEM_PROMPT = `
You are an Agentic AI assistant whose job is to CLONE websites locally into organized folders.

Available tools:
- fetchAssets(url: string): Launches a headless browser, waits for page load, returns full rendered HTML and a list of asset URLs (link/script/img).
- saveFile(input: { filename: string, content: string }): Saves a file locally into the correct subfolder based on extension:
    - .html/.htm → html/
    - .css → css/
    - .js → js/
    - images (.png, .jpg, .jpeg, .gif, .svg, .ico, .webp) → images/
    - fonts (.woff, .woff2, .ttf, .otf, .eot) → fonts/
    - everything else → misc/
- downloadAndSave(url: string): Downloads a resource from URL and saves it to the appropriate subfolder; if not provided it is auto-detected by extension).


Workflow:
1. Call fetchAssets(url) to fetch raw HTML.
2. Save it as "index.html" in html/ using saveFile.
3. For each unique asset, download using downloadAndSave.  
   - CSS → css/  
   - JS → js/  
   - Images → images/  
   - Fonts → fonts/  
   - Others → misc/  
4. Final output should be a working offline clone of the target website.

Rules:
- Always store assets neatly in subfolders.
- Never skip assets; continue if a download fails.
- When using tools, always return valid JSON { step, tool_name, input }.
- Do not output free text unless at step: "OUTPUT". 
- At the end, produce a success message that the site has been cloned offline.
    Output JSON Message Format (each assistant message MUST be one of these):
    { "step": "START"  , "content": "string" }
    { "step": "THINK"  , "content": "string" }
    { "step": "TOOL"   , "tool_name": "fetchAssets|saveFile|downloadAndSave", "input": <string OR object exactly as required by that tool> }
    { "step": "OBSERVE", "content": <tool response> }
    { "step": "OUTPUT" , "content": "string" }

    Example :
    ASSISTANT: {"step":"START","content":"User wants to clone https://www.example.com"}
    ASSISTANT: {"step":"THINK","content":"Fetch HTML via fetchAssets"}
    ASSISTANT: {"step":"TOOL","tool_name":"fetchAssets","input":"https://www.example.com"}
    DEVELOPER: {"step":"OBSERVE","content":"<!DOCTYPE html>..."}
    ASSISTANT: {"step":"THINK","content":"Save HTML as index.html"}
    ASSISTANT: {"step":"TOOL","tool_name":"saveFile","input":{"filename":"index.html","content":"<!DOCTYPE html>..."}}
    DEVELOPER: {"step":"OBSERVE","content":"Saved index.html in targetDir"}
    ASSISTANT: {"step":"THINK","content":"Fetch assets"}
    ASSISTANT: {"step":"TOOL","tool_name":"fetchAssets","input":"https://www.example.com"}
    DEVELOPER: {"step":"OBSERVE","content":{"html":"<!DOCTYPE html>...","assets":["https://www.example.com/app.css","https://www.example.com/app.js","https://www.example.com/logo.png"]}}
    ASSISTANT: {"step":"THINK","content":"Download CSS"}
    ASSISTANT: {"step":"TOOL","tool_name":"downloadAndSave","input":{"url":"https://www.example.com/app.css","subfolder":"css"}}
    DEVELOPER: {"step":"OBSERVE","content":"✅ Saved .../css/app.css"}
    ... (download JS, images)
    ASSISTANT: {"step":"OUTPUT","content":"✅ Cloned site. Saved index.html and 1 CSS, 1 JS, 1 image into /Users/hrishithsavir/Desktop/genai/file"}


Your role: Fully automate the cloning process and produce a self-contained offline copy of any given website.
`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Clone - https://www.piyushgarg.dev/",
    },
  ];

  while (true) {

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messages,
    });

    const rawcontent = response.choices[0].message.content;
    const parsedContent = JSON.parse(rawcontent);

    messages.push({
      role: "assistant",
      content: JSON.stringify(parsedContent),
    });

    if (parsedContent.step === "START") {
      console.log("\t🔥", parsedContent.content);
      continue;
    }
    if (parsedContent.step === "THINK") {
      console.log(`\t🧠`, parsedContent.content);
      continue;
    }

    if (parsedContent.step === "TOOL") {
      const tooltocall = parsedContent.tool_name;
      if (!TOOL_MAP[tooltocall]) {
        messages.push({
          role: "developer",
          content: `There is no such tool as ${tooltocall}`,
        });
        continue;
      }
      let responsefromtool;
      try {
        if (tooltocall === "saveFile") {
          let filename, content;

          if (typeof parsedContent.input === "string") {
            // fallback: try to split at first comma

            const parts = parsedContent.input.split(",", 2);
            filename = parts[0]?.trim();
            content = parsedContent.input
              .slice(parsedContent.input.indexOf(",") + 1)
              .trim();
          } else {
            ({ filename, content } = parsedContent.input);
          }

          // const { filename, content } = parsedContent.input;
          responsefromtool = await TOOL_MAP.saveFile(filename, content);
        } else if (tooltocall === "downloadAndSave") {
          // Expect input: { url: "...", subfolder: "..." }
          const { url, subfolder } = parsedContent.input;
          responsefromtool = await TOOL_MAP.downloadAndSave(url, subfolder);
        } else {
          // Default case (single string input)
          responsefromtool = await TOOL_MAP[tooltocall](parsedContent.input);
        }
      } catch (err) {
        console.error(`❌ Tool ${tooltocall} failed:`, err.message);
        responsefromtool = { error: err.message };
      }

      messages.push({
        role: "developer",
        content: JSON.stringify({ step: "OBSERVE", content: responsefromtool }),
      });
      continue;
    }

    if (parsedContent.step === "OUTPUT") {
      console.log(`🤖`, parsedContent.content);
      break;
    }
  }
}

main();


export { fetchAssets, saveFile, saveAndRewriteHTML };