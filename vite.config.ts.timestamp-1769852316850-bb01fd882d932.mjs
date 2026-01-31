// vite.config.ts
import { defineConfig } from "file:///D:/Self/Web/Projects/Simba/Antigravity/Refueling/simba-refuel/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Self/Web/Projects/Simba/Antigravity/Refueling/simba-refuel/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///D:/Self/Web/Projects/Simba/Antigravity/Refueling/simba-refuel/node_modules/lovable-tagger/dist/index.js";

// plugins/vite-email-server.ts
import dotenv from "file:///D:/Self/Web/Projects/Simba/Antigravity/Refueling/simba-refuel/node_modules/dotenv/lib/main.js";
import formidable from "file:///D:/Self/Web/Projects/Simba/Antigravity/Refueling/simba-refuel/node_modules/formidable/src/index.js";
import fs from "fs";

// src/lib/email-service.ts
import nodemailer from "file:///D:/Self/Web/Projects/Simba/Antigravity/Refueling/simba-refuel/node_modules/nodemailer/lib/nodemailer.js";
async function sendEmailService(payload) {
  const { to, cc, subject, message, records, branchName, date, attachments } = payload;
  records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const formatTime = (dateStr2) => {
    return new Date(dateStr2).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  const tableRows = records.map((r) => `
      <tr>
        <td>${r.reservationNumber}</td>
        <td>${r.rego}</td>
        <td>${r.addedToRCM ? "Yes" : "No"}</td>
        <td>$${r.amount.toFixed(2)}</td>
        <td>${r.refuelledBy}</td>
        <td>${formatTime(r.createdAt)}</td>
      </tr>
    `).join("");
  const reportDate = new Date(date);
  const dateStr = reportDate.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const html = `
    <p>Dear Team,</p>
    <p>Please find the refuel list for <b>${branchName}</b> on <b>${dateStr}</b>.</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse; width: 100%; max-width: 800px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="text-align: left;">Reservation</th>
          <th style="text-align: left;">Registration</th>
          <th style="text-align: left;">RCM Status</th>
          <th style="text-align: left;">Amount</th>
          <th style="text-align: left;">Refuelled By</th>
          <th style="text-align: left;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ${message ? `
    <div style="margin-top: 20px;">
      <p><b>Notes:</b></p>
      <p>${message.replace(/\n/g, "<br>")}</p>
    </div>` : ""}
    <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 6px;">
      <p style="margin: 0;"><b>Summary:</b></p>
      <p style="margin: 5px 0;">Total Records: ${records.length}</p>
      <p style="margin: 5px 0;">Total Amount: <b>$${records.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</b></p>
      <p style="margin: 5px 0;">Added to RCM: ${records.filter((r) => r.addedToRCM).length}</p>
    </div>
    <p style="margin-top: 30px; color: #6b7280; font-size: 0.9em;">Best regards,<br>${branchName} Team</p>
  `;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
  await transporter.sendMail({
    from: `"${branchName} Team" <${process.env.GMAIL_USER}>`,
    to,
    cc: cc && cc.trim() !== "" ? cc.split(",").map((email) => email.trim()) : void 0,
    subject,
    html,
    attachments: attachments && attachments.length > 0 ? attachments : void 0
  });
}

// plugins/vite-email-server.ts
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
function emailServerPlugin() {
  return {
    name: "vite-email-server",
    configureServer(server) {
      console.log("[Vite Email Plugin] Loaded.");
      console.log("[Vite Email Plugin] GMAIL_USER present:", !!process.env.GMAIL_USER);
      console.log("[Vite Email Plugin] GMAIL_PASS present:", !!process.env.GMAIL_PASS);
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/send-email" && req.method === "POST") {
          const form = formidable({});
          try {
            const [fields, files] = await form.parse(req);
            const getField = (key) => {
              const val = fields[key];
              if (Array.isArray(val)) return val[0] || "";
              return val || "";
            };
            const to = getField("to");
            const subject = getField("subject");
            if (!to || !subject) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing required fields" }));
              return;
            }
            let records = [];
            try {
              records = JSON.parse(getField("records") || "[]");
            } catch (e) {
              console.error("[Vite Email] Failed to parse records JSON");
            }
            const attachments = [];
            const fileItems = files.attachments;
            if (fileItems) {
              const items = Array.isArray(fileItems) ? fileItems : [fileItems];
              for (const file of items) {
                if (file && file.filepath) {
                  attachments.push({
                    filename: file.originalFilename || "attachment",
                    content: fs.readFileSync(file.filepath)
                  });
                }
              }
            }
            const payload = {
              to,
              cc: getField("cc"),
              subject,
              message: getField("message"),
              branchName: getField("branchName"),
              date: getField("date") || (/* @__PURE__ */ new Date()).toISOString(),
              records,
              attachments
            };
            await sendEmailService(payload);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            console.error("[Vite Email Plugin] Error:", err.message);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          next();
        }
      });
    }
  };
}

// plugins/vite-rcm-proxy.ts
import https from "https";
import querystring from "querystring";
function rcmProxyPlugin() {
  return {
    name: "vite-rcm-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/test-rcm-login" && req.method === "POST") {
          console.log("[RCM Proxy] Starting login test...");
          try {
            const getOptions = {
              hostname: "bookings.rentalcarmanager.com",
              path: "/account/login.aspx",
              method: "GET",
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            };
            const getResponse = await new Promise((resolve, reject) => {
              const request = https.request(getOptions, (response) => {
                let data = "";
                response.on("data", (chunk) => data += chunk);
                response.on("end", () => resolve({ body: data, headers: response.headers }));
              });
              request.on("error", reject);
              request.end();
            });
            const initialCookies = (getResponse.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
            console.log("[RCM Proxy] Initial cookies obtained");
            const viewStateMatch = getResponse.body.match(/id="__VIEWSTATE" value="(.*?)"/);
            const viewStateGenMatch = getResponse.body.match(/id="__VIEWSTATEGENERATOR" value="(.*?)"/);
            const eventValidationMatch = getResponse.body.match(/id="__EVENTVALIDATION" value="(.*?)"/);
            if (!viewStateMatch || !eventValidationMatch) {
              throw new Error("Failed to parse validation fields from login page.");
            }
            const viewState = viewStateMatch[1];
            const viewStateGenerator = viewStateGenMatch ? viewStateGenMatch[1] : "";
            const eventValidation = eventValidationMatch[1];
            const postData = querystring.stringify({
              "__EVENTTARGET": "",
              "__EVENTARGUMENT": "",
              "__VIEWSTATE": viewState,
              "__VIEWSTATEGENERATOR": viewStateGenerator,
              "__EVENTVALIDATION": eventValidation,
              "ctl00$MainContent$Username": "devsimba",
              "ctl00$MainContent$Password": "Welcome5",
              "ctl00$MainContent$LoginButton": "Sign in"
              // The button value is often required in ASP.NET
            });
            const postOptions = {
              hostname: "bookings.rentalcarmanager.com",
              path: "/account/login.aspx",
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
                "Cookie": initialCookies,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://bookings.rentalcarmanager.com",
                "Referer": "https://bookings.rentalcarmanager.com/account/login.aspx"
              }
            };
            const postResponse = await new Promise((resolve, reject) => {
              const request = https.request(postOptions, (response) => {
                response.resume();
                response.on("end", () => resolve({ headers: response.headers, statusCode: response.statusCode }));
              });
              request.on("error", reject);
              request.write(postData);
              request.end();
            });
            console.log(`[RCM Proxy] Status Code: ${postResponse.statusCode}`);
            const location = postResponse.headers.location || "";
            const newCookies = (postResponse.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
            const allCookies = [initialCookies, newCookies].filter(Boolean).join("; ");
            if (postResponse.statusCode === 302 && location.toLowerCase().includes("validateuser")) {
              console.log("[RCM Proxy] Login Verified: Redirecting to validateuser. Following redirect...");
              const cookiesAfterPost = [initialCookies, newCookies].filter(Boolean).join("; ");
              const validatePath = location.startsWith("http") ? new URL(location).pathname : location;
              const validateOptions = {
                hostname: "bookings.rentalcarmanager.com",
                path: validatePath,
                method: "GET",
                headers: {
                  "Cookie": cookiesAfterPost,
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
              };
              const validateResponse = await new Promise((resolve, reject) => {
                const request = https.request(validateOptions, (response) => {
                  response.resume();
                  response.on("end", () => resolve({ headers: response.headers, statusCode: response.statusCode }));
                });
                request.on("error", reject);
                request.end();
              });
              const finalCookies = (validateResponse.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
              const allC = [cookiesAfterPost, finalCookies].filter(Boolean).join("; ");
              console.log(`[RCM Proxy] ValidateUser Status: ${validateResponse.statusCode}`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: true,
                message: "Login Successful (Finalized)",
                redirect: validateResponse.headers.location || location,
                cookies: allC
              }));
            } else {
              console.warn(`[RCM Proxy] Login Failed. Redirected to: ${location}`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                success: false,
                message: "Login Failed: Invalid Credentials or Session.",
                details: `Redirected to: ${location}`,
                cookies: allCookies
              }));
            }
          } catch (error) {
            console.error("[RCM Proxy] Error:", error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error.message }));
          }
        } else if (req.url === "/api/rcm-reservation-search" && req.method === "POST") {
          const form = new URLSearchParams();
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", async () => {
            try {
              const { rego, cookies, dateStr } = JSON.parse(body);
              const fetchWithRedirects = async (hostname, path2, cookies2) => {
                let currentPath = path2;
                let currentHostname = hostname;
                let redirectCount = 0;
                const maxRedirects = 5;
                while (redirectCount < maxRedirects) {
                  const options = {
                    hostname: currentHostname,
                    path: currentPath,
                    method: "GET",
                    headers: {
                      "Cookie": cookies2,
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                  };
                  const response = await new Promise((resolve, reject) => {
                    const req2 = https.request(options, (res2) => {
                      let data = "";
                      res2.on("data", (chunk) => data += chunk);
                      res2.on("end", () => resolve({ body: data, headers: res2.headers, statusCode: res2.statusCode }));
                    });
                    req2.on("error", reject);
                    req2.end();
                  });
                  if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
                    const location = response.headers.location;
                    if (location) {
                      console.log(`[RCM Proxy] Redirecting to: ${location}`);
                      if (location.startsWith("http")) {
                        const url = new URL(location);
                        currentHostname = url.hostname;
                        currentPath = url.pathname + url.search;
                      } else {
                        currentPath = location;
                      }
                      redirectCount++;
                      continue;
                    }
                  }
                  return response;
                }
                throw new Error("Too many redirects");
              };
              const getResponse = await fetchWithRedirects("bookings.rentalcarmanager.com", "/report/reservation_enquiry", cookies);
              const viewStateMatch = getResponse.body.match(/id="__VIEWSTATE" value="(.*?)"/);
              const viewStateGenMatch = getResponse.body.match(/id="__VIEWSTATEGENERATOR" value="(.*?)"/);
              const eventValidationMatch = getResponse.body.match(/id="__EVENTVALIDATION" value="(.*?)"/);
              if (!viewStateMatch) {
                throw new Error("Failed to find ViewState on search page. Session may be expired.");
              }
              const viewState = viewStateMatch[1];
              const viewStateGenerator = viewStateGenMatch ? viewStateGenMatch[1] : "";
              const eventValidation = eventValidationMatch ? eventValidationMatch[1] : "";
              const postData = querystring.stringify({
                "__EVENTTARGET": "ctl00$MainBodyContent$butRunReport",
                "__EVENTARGUMENT": "",
                "__VIEWSTATE": viewState,
                "__VIEWSTATEGENERATOR": viewStateGenerator,
                "__EVENTVALIDATION": eventValidation,
                "searchfor": "",
                "cmbReportLocationID": "0",
                "txtStartingDay197": dateStr,
                // e.g. 31/01/2026
                "txtEndingDay197": dateStr,
                "cmbsSearchFor": "registrationno",
                "txtsSearchString197": rego,
                "cmbApplyDateRate": "All",
                "hidSeeAllFleet": "Yes",
                "hidAccessLevel": "100",
                // Assuming default
                "hidBranchID": "9",
                // Assuming default or need to extract? Using 9 from example.
                "Confirmed_length": "-1",
                "ctl00$MainBodyContent$reportcode": "reservation_enquiry",
                "ctl00$MainBodyContent$PageNo": "0",
                "ctl00$MainBodyContent$ItemsPerPage": "0",
                "ctl00$MainBodyContent$AutoGenerated": "0",
                "ctl00$MainBodyContent$ServerSide": "False",
                "ctl00$MainBodyContent$fxdHdr": "1",
                "ctl00$MainBodyContent$hdnReportData": "{}",
                "ctl00$MainBodyContent$hdnSummaryFields": "{}"
              });
              const postOptions = {
                hostname: "bookings.rentalcarmanager.com",
                path: "/report/reservation_enquiry",
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  "Content-Length": Buffer.byteLength(postData),
                  "Cookie": cookies,
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Origin": "https://bookings.rentalcarmanager.com",
                  "Referer": "https://bookings.rentalcarmanager.com/report/reservation_enquiry"
                }
              };
              const postResponse = await new Promise((resolve, reject) => {
                const request = https.request(postOptions, (response) => {
                  let data = "";
                  response.on("data", (chunk) => data += chunk);
                  response.on("end", () => resolve({ body: data, statusCode: response.statusCode }));
                });
                request.on("error", reject);
                request.write(postData);
                request.end();
              });
              const tableMatch = postResponse.body.match(/<table[^>]*id="Confirmed"[^>]*>([\s\S]*?)<\/table>/);
              const results = [];
              if (tableMatch) {
                const tableContent = tableMatch[1];
                const rows = tableContent.match(/<tr[\s\S]*?<\/tr>/g);
                if (rows) {
                  rows.forEach((row) => {
                    if (row.includes("<th")) return;
                    const resNoMatch = row.match(/ReportPopup\('[^']+\/(\d+)\//);
                    const resNo = resNoMatch ? resNoMatch[1] : "";
                    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
                    if (cells && cells.length > 4 && resNo) {
                      const clean = (s) => s.replace(/<[^>]+>/g, "").trim();
                      const customer = clean(cells[4]);
                      const vehicle = clean(cells[6]);
                      results.push({
                        resNo,
                        customer,
                        vehicle,
                        rawHtml: row
                        // Keep raw if needed for debug? Maybe too big.
                      });
                    }
                  });
                }
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, results }));
            } catch (err) {
              console.error("Search Proxy Error:", err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    }
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "D:\\Self\\Web\\Projects\\Simba\\Antigravity\\Refueling\\simba-refuel";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  plugins: [
    emailServerPlugin(),
    rcmProxyPlugin(),
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGx1Z2lucy92aXRlLWVtYWlsLXNlcnZlci50cyIsICJzcmMvbGliL2VtYWlsLXNlcnZpY2UudHMiLCAicGx1Z2lucy92aXRlLXJjbS1wcm94eS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXFNlbGZcXFxcV2ViXFxcXFByb2plY3RzXFxcXFNpbWJhXFxcXEFudGlncmF2aXR5XFxcXFJlZnVlbGluZ1xcXFxzaW1iYS1yZWZ1ZWxcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFNlbGZcXFxcV2ViXFxcXFByb2plY3RzXFxcXFNpbWJhXFxcXEFudGlncmF2aXR5XFxcXFJlZnVlbGluZ1xcXFxzaW1iYS1yZWZ1ZWxcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L1NlbGYvV2ViL1Byb2plY3RzL1NpbWJhL0FudGlncmF2aXR5L1JlZnVlbGluZy9zaW1iYS1yZWZ1ZWwvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuaW1wb3J0IGVtYWlsU2VydmVyUGx1Z2luIGZyb20gXCIuL3BsdWdpbnMvdml0ZS1lbWFpbC1zZXJ2ZXJcIjtcclxuaW1wb3J0IHJjbVByb3h5UGx1Z2luIGZyb20gXCIuL3BsdWdpbnMvdml0ZS1yY20tcHJveHlcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgZW1haWxTZXJ2ZXJQbHVnaW4oKSxcclxuICAgIHJjbVByb3h5UGx1Z2luKCksXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbW9kZSA9PT0gJ2RldmVsb3BtZW50JyAmJlxyXG4gICAgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxTZWxmXFxcXFdlYlxcXFxQcm9qZWN0c1xcXFxTaW1iYVxcXFxBbnRpZ3Jhdml0eVxcXFxSZWZ1ZWxpbmdcXFxcc2ltYmEtcmVmdWVsXFxcXHBsdWdpbnNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFNlbGZcXFxcV2ViXFxcXFByb2plY3RzXFxcXFNpbWJhXFxcXEFudGlncmF2aXR5XFxcXFJlZnVlbGluZ1xcXFxzaW1iYS1yZWZ1ZWxcXFxccGx1Z2luc1xcXFx2aXRlLWVtYWlsLXNlcnZlci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovU2VsZi9XZWIvUHJvamVjdHMvU2ltYmEvQW50aWdyYXZpdHkvUmVmdWVsaW5nL3NpbWJhLXJlZnVlbC9wbHVnaW5zL3ZpdGUtZW1haWwtc2VydmVyLnRzXCI7aW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnO1xyXG5kb3RlbnYuY29uZmlnKHsgcGF0aDogJy5lbnYnIH0pO1xyXG5kb3RlbnYuY29uZmlnKHsgcGF0aDogJy5lbnYubG9jYWwnIH0pO1xyXG5pbXBvcnQgdHlwZSB7IFBsdWdpbiwgVml0ZURldlNlcnZlciB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgZm9ybWlkYWJsZSBmcm9tICdmb3JtaWRhYmxlJztcclxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0IHsgc2VuZEVtYWlsU2VydmljZSwgRW1haWxQYXlsb2FkIH0gZnJvbSAnLi4vc3JjL2xpYi9lbWFpbC1zZXJ2aWNlJzsgLy8gSW1wb3J0IHNvdXJjZSBUUyBkaXJlY3RseVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZW1haWxTZXJ2ZXJQbHVnaW4oKTogUGx1Z2luIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbmFtZTogJ3ZpdGUtZW1haWwtc2VydmVyJyxcclxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyOiBWaXRlRGV2U2VydmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVml0ZSBFbWFpbCBQbHVnaW5dIExvYWRlZC4nKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWaXRlIEVtYWlsIFBsdWdpbl0gR01BSUxfVVNFUiBwcmVzZW50OicsICEhcHJvY2Vzcy5lbnYuR01BSUxfVVNFUik7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVml0ZSBFbWFpbCBQbHVnaW5dIEdNQUlMX1BBU1MgcHJlc2VudDonLCAhIXByb2Nlc3MuZW52LkdNQUlMX1BBU1MpO1xyXG5cclxuICAgICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChyZXEudXJsID09PSAnL2FwaS9zZW5kLWVtYWlsJyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtID0gZm9ybWlkYWJsZSh7fSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IFtmaWVsZHMsIGZpbGVzXSA9IGF3YWl0IGZvcm0ucGFyc2UocmVxKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlbHBlciB0byBnZXQgc2luZ2xlIHZhbHVlIGZyb20gdW5rbm93biBmaWVsZCB0eXBlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdldEZpZWxkID0gKGtleTogc3RyaW5nKTogc3RyaW5nID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbCA9IGZpZWxkc1trZXldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsKSkgcmV0dXJuIHZhbFswXSB8fCAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWwgfHwgJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0byA9IGdldEZpZWxkKCd0bycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJqZWN0ID0gZ2V0RmllbGQoJ3N1YmplY3QnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdG8gfHwgIXN1YmplY3QpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZHMnIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGFyc2UgcmVjb3JkcyBKU09OXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZWNvcmRzOiBhbnlbXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVjb3JkcyA9IEpTT04ucGFyc2UoZ2V0RmllbGQoJ3JlY29yZHMnKSB8fCAnW10nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1ZpdGUgRW1haWxdIEZhaWxlZCB0byBwYXJzZSByZWNvcmRzIEpTT04nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBhdHRhY2htZW50c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhdHRhY2htZW50czogeyBmaWxlbmFtZTogc3RyaW5nOyBjb250ZW50OiBCdWZmZXIgfVtdID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVJdGVtcyA9IGZpbGVzLmF0dGFjaG1lbnRzO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGVJdGVtcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5pc0FycmF5KGZpbGVJdGVtcykgPyBmaWxlSXRlbXMgOiBbZmlsZUl0ZW1zXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBpdGVtcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlICYmIGZpbGUuZmlsZXBhdGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlbmFtZTogZmlsZS5vcmlnaW5hbEZpbGVuYW1lIHx8ICdhdHRhY2htZW50JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGZzLnJlYWRGaWxlU3luYyhmaWxlLmZpbGVwYXRoKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbnN0cnVjdCBwYXlsb2FkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQ6IEVtYWlsUGF5bG9hZCA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2M6IGdldEZpZWxkKCdjYycpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGdldEZpZWxkKCdtZXNzYWdlJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmFuY2hOYW1lOiBnZXRGaWVsZCgnYnJhbmNoTmFtZScpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZTogZ2V0RmllbGQoJ2RhdGUnKSB8fCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWNvcmRzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNlbmRFbWFpbFNlcnZpY2UocGF5bG9hZCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWaXRlIEVtYWlsIFBsdWdpbl0gRXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXh0KCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICB9O1xyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcU2VsZlxcXFxXZWJcXFxcUHJvamVjdHNcXFxcU2ltYmFcXFxcQW50aWdyYXZpdHlcXFxcUmVmdWVsaW5nXFxcXHNpbWJhLXJlZnVlbFxcXFxzcmNcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxTZWxmXFxcXFdlYlxcXFxQcm9qZWN0c1xcXFxTaW1iYVxcXFxBbnRpZ3Jhdml0eVxcXFxSZWZ1ZWxpbmdcXFxcc2ltYmEtcmVmdWVsXFxcXHNyY1xcXFxsaWJcXFxcZW1haWwtc2VydmljZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovU2VsZi9XZWIvUHJvamVjdHMvU2ltYmEvQW50aWdyYXZpdHkvUmVmdWVsaW5nL3NpbWJhLXJlZnVlbC9zcmMvbGliL2VtYWlsLXNlcnZpY2UudHNcIjtpbXBvcnQgbm9kZW1haWxlciBmcm9tIFwibm9kZW1haWxlclwiO1xyXG5cclxuLyoqXHJcbiAqIFBheWxvYWQgc3RydWN0dXJlIGZvciB0aGUgZW1haWwgcmVwb3J0LlxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBFbWFpbFBheWxvYWQge1xyXG4gIHRvOiBzdHJpbmc7XHJcbiAgY2M/OiBzdHJpbmc7XHJcbiAgc3ViamVjdDogc3RyaW5nO1xyXG4gIG1lc3NhZ2U/OiBzdHJpbmc7XHJcbiAgcmVjb3JkczogYW55W107IC8vIENvbnNpZGVyIGRlZmluaW5nIGEgc3RyaWN0IHR5cGUgZm9yIHJlY29yZHMgaWYgcG9zc2libGUgaW4gZnV0dXJlXHJcbiAgYnJhbmNoTmFtZTogc3RyaW5nO1xyXG4gIGRhdGU6IHN0cmluZyB8IERhdGU7XHJcbiAgYXR0YWNobWVudHM/OiB7IGZpbGVuYW1lOiBzdHJpbmc7IGNvbnRlbnQ6IEJ1ZmZlciB9W107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3JlIHNlcnZpY2UgdG8gZm9ybWF0IGFuZCBzZW5kIHRoZSByZWZ1ZWwgcmVwb3J0IGVtYWlsLlxyXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgYnkgYm90aCB0aGUgbG9jYWwgVml0ZSBtaWRkbGV3YXJlIGFuZCB0aGUgVmVyY2VsIHNlcnZlcmxlc3MgZnVuY3Rpb24uXHJcbiAqIFxyXG4gKiBAcGFyYW0gcGF5bG9hZCAtIFRoZSBlbWFpbCBkZXRhaWxzIGFuZCBkYXRhIHJlY29yZHMuXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2VuZEVtYWlsU2VydmljZShwYXlsb2FkOiBFbWFpbFBheWxvYWQpIHtcclxuICBjb25zdCB7IHRvLCBjYywgc3ViamVjdCwgbWVzc2FnZSwgcmVjb3JkcywgYnJhbmNoTmFtZSwgZGF0ZSwgYXR0YWNobWVudHMgfSA9IHBheWxvYWQ7XHJcblxyXG4gIC8vIFNvcnQgcmVjb3JkcyBieSBjcmVhdGVkQXQgKGFzY2VuZGluZylcclxuICByZWNvcmRzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShhLmNyZWF0ZWRBdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYi5jcmVhdGVkQXQpLmdldFRpbWUoKSk7XHJcblxyXG4gIC8vIEhlbHBlciB0byBmb3JtYXQgdGltZVxyXG4gIGNvbnN0IGZvcm1hdFRpbWUgPSAoZGF0ZVN0cjogc3RyaW5nKSA9PiB7XHJcbiAgICByZXR1cm4gbmV3IERhdGUoZGF0ZVN0cikudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcsIGhvdXIxMjogZmFsc2UgfSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gQnVpbGQgSFRNTCB0YWJsZSByb3dzXHJcbiAgY29uc3QgdGFibGVSb3dzID0gcmVjb3Jkcy5tYXAoKHI6IGFueSkgPT4gYFxyXG4gICAgICA8dHI+XHJcbiAgICAgICAgPHRkPiR7ci5yZXNlcnZhdGlvbk51bWJlcn08L3RkPlxyXG4gICAgICAgIDx0ZD4ke3IucmVnb308L3RkPlxyXG4gICAgICAgIDx0ZD4ke3IuYWRkZWRUb1JDTSA/ICdZZXMnIDogJ05vJ308L3RkPlxyXG4gICAgICAgIDx0ZD4kJHtyLmFtb3VudC50b0ZpeGVkKDIpfTwvdGQ+XHJcbiAgICAgICAgPHRkPiR7ci5yZWZ1ZWxsZWRCeX08L3RkPlxyXG4gICAgICAgIDx0ZD4ke2Zvcm1hdFRpbWUoci5jcmVhdGVkQXQpfTwvdGQ+XHJcbiAgICAgIDwvdHI+XHJcbiAgICBgKS5qb2luKFwiXCIpO1xyXG5cclxuICBjb25zdCByZXBvcnREYXRlID0gbmV3IERhdGUoZGF0ZSk7XHJcbiAgY29uc3QgZGF0ZVN0ciA9IHJlcG9ydERhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1BVScsIHsgZGF5OiAnMi1kaWdpdCcsIG1vbnRoOiAnMi1kaWdpdCcsIHllYXI6ICdudW1lcmljJyB9KTtcclxuXHJcbiAgY29uc3QgaHRtbCA9IGBcclxuICAgIDxwPkRlYXIgVGVhbSw8L3A+XHJcbiAgICA8cD5QbGVhc2UgZmluZCB0aGUgcmVmdWVsIGxpc3QgZm9yIDxiPiR7YnJhbmNoTmFtZX08L2I+IG9uIDxiPiR7ZGF0ZVN0cn08L2I+LjwvcD5cclxuICAgIDx0YWJsZSBib3JkZXI9XCIxXCIgY2VsbHBhZGRpbmc9XCI2XCIgc3R5bGU9XCJib3JkZXItY29sbGFwc2U6Y29sbGFwc2U7IHdpZHRoOiAxMDAlOyBtYXgtd2lkdGg6IDgwMHB4O1wiPlxyXG4gICAgICA8dGhlYWQ+XHJcbiAgICAgICAgPHRyIHN0eWxlPVwiYmFja2dyb3VuZC1jb2xvcjogI2YzZjRmNjtcIj5cclxuICAgICAgICAgIDx0aCBzdHlsZT1cInRleHQtYWxpZ246IGxlZnQ7XCI+UmVzZXJ2YXRpb248L3RoPlxyXG4gICAgICAgICAgPHRoIHN0eWxlPVwidGV4dC1hbGlnbjogbGVmdDtcIj5SZWdpc3RyYXRpb248L3RoPlxyXG4gICAgICAgICAgPHRoIHN0eWxlPVwidGV4dC1hbGlnbjogbGVmdDtcIj5SQ00gU3RhdHVzPC90aD5cclxuICAgICAgICAgIDx0aCBzdHlsZT1cInRleHQtYWxpZ246IGxlZnQ7XCI+QW1vdW50PC90aD5cclxuICAgICAgICAgIDx0aCBzdHlsZT1cInRleHQtYWxpZ246IGxlZnQ7XCI+UmVmdWVsbGVkIEJ5PC90aD5cclxuICAgICAgICAgIDx0aCBzdHlsZT1cInRleHQtYWxpZ246IGxlZnQ7XCI+VGltZTwvdGg+XHJcbiAgICAgICAgPC90cj5cclxuICAgICAgPC90aGVhZD5cclxuICAgICAgPHRib2R5PlxyXG4gICAgICAgICR7dGFibGVSb3dzfVxyXG4gICAgICA8L3Rib2R5PlxyXG4gICAgPC90YWJsZT5cclxuICAgICR7bWVzc2FnZSA/IGBcclxuICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOiAyMHB4O1wiPlxyXG4gICAgICA8cD48Yj5Ob3Rlczo8L2I+PC9wPlxyXG4gICAgICA8cD4ke21lc3NhZ2UucmVwbGFjZSgvXFxuL2csICc8YnI+Jyl9PC9wPlxyXG4gICAgPC9kaXY+YCA6ICcnfVxyXG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6IDIwcHg7IHBhZGRpbmc6IDE1cHg7IGJhY2tncm91bmQtY29sb3I6ICNmOWZhZmI7IGJvcmRlci1yYWRpdXM6IDZweDtcIj5cclxuICAgICAgPHAgc3R5bGU9XCJtYXJnaW46IDA7XCI+PGI+U3VtbWFyeTo8L2I+PC9wPlxyXG4gICAgICA8cCBzdHlsZT1cIm1hcmdpbjogNXB4IDA7XCI+VG90YWwgUmVjb3JkczogJHtyZWNvcmRzLmxlbmd0aH08L3A+XHJcbiAgICAgIDxwIHN0eWxlPVwibWFyZ2luOiA1cHggMDtcIj5Ub3RhbCBBbW91bnQ6IDxiPiQke3JlY29yZHMucmVkdWNlKChzdW06IG51bWJlciwgcjogYW55KSA9PiBzdW0gKyByLmFtb3VudCwgMCkudG9GaXhlZCgyKX08L2I+PC9wPlxyXG4gICAgICA8cCBzdHlsZT1cIm1hcmdpbjogNXB4IDA7XCI+QWRkZWQgdG8gUkNNOiAke3JlY29yZHMuZmlsdGVyKChyOiBhbnkpID0+IHIuYWRkZWRUb1JDTSkubGVuZ3RofTwvcD5cclxuICAgIDwvZGl2PlxyXG4gICAgPHAgc3R5bGU9XCJtYXJnaW4tdG9wOiAzMHB4OyBjb2xvcjogIzZiNzI4MDsgZm9udC1zaXplOiAwLjllbTtcIj5CZXN0IHJlZ2FyZHMsPGJyPiR7YnJhbmNoTmFtZX0gVGVhbTwvcD5cclxuICBgO1xyXG5cclxuICAvLyBOb2RlbWFpbGVyIHNldHVwXHJcbiAgY29uc3QgdHJhbnNwb3J0ZXIgPSBub2RlbWFpbGVyLmNyZWF0ZVRyYW5zcG9ydCh7XHJcbiAgICBzZXJ2aWNlOiBcImdtYWlsXCIsXHJcbiAgICBhdXRoOiB7XHJcbiAgICAgIHVzZXI6IHByb2Nlc3MuZW52LkdNQUlMX1VTRVIsXHJcbiAgICAgIHBhc3M6IHByb2Nlc3MuZW52LkdNQUlMX1BBU1MsXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICAvLyBTZW5kIGVtYWlsXHJcbiAgYXdhaXQgdHJhbnNwb3J0ZXIuc2VuZE1haWwoe1xyXG4gICAgZnJvbTogYFwiJHticmFuY2hOYW1lfSBUZWFtXCIgPCR7cHJvY2Vzcy5lbnYuR01BSUxfVVNFUn0+YCxcclxuICAgIHRvLFxyXG4gICAgY2M6IGNjICYmIGNjLnRyaW0oKSAhPT0gJycgPyBjYy5zcGxpdCgnLCcpLm1hcCgoZW1haWw6IHN0cmluZykgPT4gZW1haWwudHJpbSgpKSA6IHVuZGVmaW5lZCxcclxuICAgIHN1YmplY3QsXHJcbiAgICBodG1sLFxyXG4gICAgYXR0YWNobWVudHM6IGF0dGFjaG1lbnRzICYmIGF0dGFjaG1lbnRzLmxlbmd0aCA+IDAgPyBhdHRhY2htZW50cyA6IHVuZGVmaW5lZCxcclxuICB9KTtcclxufVxyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXFNlbGZcXFxcV2ViXFxcXFByb2plY3RzXFxcXFNpbWJhXFxcXEFudGlncmF2aXR5XFxcXFJlZnVlbGluZ1xcXFxzaW1iYS1yZWZ1ZWxcXFxccGx1Z2luc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcU2VsZlxcXFxXZWJcXFxcUHJvamVjdHNcXFxcU2ltYmFcXFxcQW50aWdyYXZpdHlcXFxcUmVmdWVsaW5nXFxcXHNpbWJhLXJlZnVlbFxcXFxwbHVnaW5zXFxcXHZpdGUtcmNtLXByb3h5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9TZWxmL1dlYi9Qcm9qZWN0cy9TaW1iYS9BbnRpZ3Jhdml0eS9SZWZ1ZWxpbmcvc2ltYmEtcmVmdWVsL3BsdWdpbnMvdml0ZS1yY20tcHJveHkudHNcIjtpbXBvcnQgdHlwZSB7IFBsdWdpbiwgVml0ZURldlNlcnZlciB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgaHR0cHMgZnJvbSAnaHR0cHMnO1xyXG5pbXBvcnQgcXVlcnlzdHJpbmcgZnJvbSAncXVlcnlzdHJpbmcnO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmNtUHJveHlQbHVnaW4oKTogUGx1Z2luIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbmFtZTogJ3ZpdGUtcmNtLXByb3h5JyxcclxuICAgICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyOiBWaXRlRGV2U2VydmVyKSB7XHJcbiAgICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVxLnVybCA9PT0gJy9hcGkvdGVzdC1yY20tbG9naW4nICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbUkNNIFByb3h5XSBTdGFydGluZyBsb2dpbiB0ZXN0Li4uJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN0ZXAgMTogR0VUIHRoZSBsb2dpbiBwYWdlIHRvIGZldGNoIGhpZGRlbiBmaWVsZHMgYW5kIGluaXRpYWwgY29va2llc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBnZXRPcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9zdG5hbWU6ICdib29raW5ncy5yZW50YWxjYXJtYW5hZ2VyLmNvbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiAnL2FjY291bnQvbG9naW4uYXNweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNidcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdldFJlc3BvbnNlID0gYXdhaXQgbmV3IFByb21pc2U8eyBib2R5OiBzdHJpbmcsIGhlYWRlcnM6IGFueSB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0ID0gaHR0cHMucmVxdWVzdChnZXRPcHRpb25zLCAocmVzcG9uc2UpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLm9uKCdkYXRhJywgKGNodW5rKSA9PiBkYXRhICs9IGNodW5rKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5vbignZW5kJywgKCkgPT4gcmVzb2x2ZSh7IGJvZHk6IGRhdGEsIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIHJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LmVuZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgQ29va2llc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbml0aWFsQ29va2llcyA9IChnZXRSZXNwb25zZS5oZWFkZXJzWydzZXQtY29va2llJ10gfHwgW10pLm1hcCgoYzogc3RyaW5nKSA9PiBjLnNwbGl0KCc7JylbMF0pLmpvaW4oJzsgJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbUkNNIFByb3h5XSBJbml0aWFsIGNvb2tpZXMgb2J0YWluZWQnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgSGlkZGVuIEZpZWxkc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3U3RhdGVNYXRjaCA9IGdldFJlc3BvbnNlLmJvZHkubWF0Y2goL2lkPVwiX19WSUVXU1RBVEVcIiB2YWx1ZT1cIiguKj8pXCIvKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld1N0YXRlR2VuTWF0Y2ggPSBnZXRSZXNwb25zZS5ib2R5Lm1hdGNoKC9pZD1cIl9fVklFV1NUQVRFR0VORVJBVE9SXCIgdmFsdWU9XCIoLio/KVwiLyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50VmFsaWRhdGlvbk1hdGNoID0gZ2V0UmVzcG9uc2UuYm9keS5tYXRjaCgvaWQ9XCJfX0VWRU5UVkFMSURBVElPTlwiIHZhbHVlPVwiKC4qPylcIi8pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF2aWV3U3RhdGVNYXRjaCB8fCAhZXZlbnRWYWxpZGF0aW9uTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHBhcnNlIHZhbGlkYXRpb24gZmllbGRzIGZyb20gbG9naW4gcGFnZS4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld1N0YXRlID0gdmlld1N0YXRlTWF0Y2hbMV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZpZXdTdGF0ZUdlbmVyYXRvciA9IHZpZXdTdGF0ZUdlbk1hdGNoID8gdmlld1N0YXRlR2VuTWF0Y2hbMV0gOiAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXZlbnRWYWxpZGF0aW9uID0gZXZlbnRWYWxpZGF0aW9uTWF0Y2hbMV07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDI6IFBPU1QgY3JlZGVudGlhbHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zdERhdGEgPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ19fRVZFTlRUQVJHRVQnOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX0VWRU5UQVJHVU1FTlQnOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX1ZJRVdTVEFURSc6IHZpZXdTdGF0ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX1ZJRVdTVEFURUdFTkVSQVRPUic6IHZpZXdTdGF0ZUdlbmVyYXRvcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX0VWRU5UVkFMSURBVElPTic6IGV2ZW50VmFsaWRhdGlvbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdGwwMCRNYWluQ29udGVudCRVc2VybmFtZSc6ICdkZXZzaW1iYScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY3RsMDAkTWFpbkNvbnRlbnQkUGFzc3dvcmQnOiAnV2VsY29tZTUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2N0bDAwJE1haW5Db250ZW50JExvZ2luQnV0dG9uJzogJ1NpZ24gaW4nIC8vIFRoZSBidXR0b24gdmFsdWUgaXMgb2Z0ZW4gcmVxdWlyZWQgaW4gQVNQLk5FVFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvc3RPcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9zdG5hbWU6ICdib29raW5ncy5yZW50YWxjYXJtYW5hZ2VyLmNvbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiAnL2FjY291bnQvbG9naW4uYXNweCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogQnVmZmVyLmJ5dGVMZW5ndGgocG9zdERhdGEpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdDb29raWUnOiBpbml0aWFsQ29va2llcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnVXNlci1BZ2VudCc6ICdNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTIwLjAuMC4wIFNhZmFyaS81MzcuMzYnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdPcmlnaW4nOiAnaHR0cHM6Ly9ib29raW5ncy5yZW50YWxjYXJtYW5hZ2VyLmNvbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1JlZmVyZXInOiAnaHR0cHM6Ly9ib29raW5ncy5yZW50YWxjYXJtYW5hZ2VyLmNvbS9hY2NvdW50L2xvZ2luLmFzcHgnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3N0UmVzcG9uc2UgPSBhd2FpdCBuZXcgUHJvbWlzZTx7IGhlYWRlcnM6IGFueSwgc3RhdHVzQ29kZT86IG51bWJlciB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0ID0gaHR0cHMucmVxdWVzdChwb3N0T3B0aW9ucywgKHJlc3BvbnNlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgdHlwaWNhbGx5IGp1c3QgbmVlZCB0aGUgaGVhZGVycyAoTG9jYXRpb24gLyBTZXQtQ29va2llKSwgd2UgZG9uJ3QgbmVjZXNzYXJpbHkgbmVlZCB0aGUgYm9keSBpZiBpdCdzIGEgcmVkaXJlY3RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5yZXN1bWUoKTsgLy8gQ29uc3VtZSBzdHJlYW1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5vbignZW5kJywgKCkgPT4gcmVzb2x2ZSh7IGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsIHN0YXR1c0NvZGU6IHJlc3BvbnNlLnN0YXR1c0NvZGUgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0Lm9uKCdlcnJvcicsIHJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0LndyaXRlKHBvc3REYXRhKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RlcCAzOiBDaGVjayBSZXN1bHRcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQSBzdWNjZXNzZnVsIGxvZ2luIHVzdWFsbHkgcmVkaXJlY3RzICgzMDIpIHRvIC9hY2NvdW50L3ZhbGlkYXRldXNlci5hc3B4IG9yIHNpbWlsYXIuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9yIGl0IG1pZ2h0IGp1c3Qgc2V0IG5ldyBjb29raWVzLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1JDTSBQcm94eV0gU3RhdHVzIENvZGU6ICR7cG9zdFJlc3BvbnNlLnN0YXR1c0NvZGV9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gcG9zdFJlc3BvbnNlLmhlYWRlcnMubG9jYXRpb24gfHwgJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld0Nvb2tpZXMgPSAocG9zdFJlc3BvbnNlLmhlYWRlcnNbJ3NldC1jb29raWUnXSB8fCBbXSkubWFwKChjOiBzdHJpbmcpID0+IGMuc3BsaXQoJzsnKVswXSkuam9pbignOyAnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbWJpbmUgY29va2llcyAoc2ltcGxlIG1lcmdlKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxDb29raWVzID0gW2luaXRpYWxDb29raWVzLCBuZXdDb29raWVzXS5maWx0ZXIoQm9vbGVhbikuam9pbignOyAnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwb3N0UmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMzAyICYmIGxvY2F0aW9uLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3ZhbGlkYXRldXNlcicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1JDTSBQcm94eV0gTG9naW4gVmVyaWZpZWQ6IFJlZGlyZWN0aW5nIHRvIHZhbGlkYXRldXNlci4gRm9sbG93aW5nIHJlZGlyZWN0Li4uJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9sbG93IHRoZSByZWRpcmVjdCB0byB2YWxpZGF0ZXVzZXIuYXNweCB0byBlbnN1cmUgd2UgZ2V0IHRoZSBmaW5hbCBhdXRoIGNvb2tpZXNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvb2tpZXNBZnRlclBvc3QgPSBbaW5pdGlhbENvb2tpZXMsIG5ld0Nvb2tpZXNdLmZpbHRlcihCb29sZWFuKS5qb2luKCc7ICcpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkYXRlUGF0aCA9IGxvY2F0aW9uLnN0YXJ0c1dpdGgoJ2h0dHAnKSA/IG5ldyBVUkwobG9jYXRpb24pLnBhdGhuYW1lIDogbG9jYXRpb247XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRhdGVPcHRpb25zID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhvc3RuYW1lOiAnYm9va2luZ3MucmVudGFsY2FybWFuYWdlci5jb20nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IHZhbGlkYXRlUGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0Nvb2tpZSc6IGNvb2tpZXNBZnRlclBvc3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNidcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkYXRlUmVzcG9uc2UgPSBhd2FpdCBuZXcgUHJvbWlzZTx7IGhlYWRlcnM6IGFueSwgc3RhdHVzQ29kZT86IG51bWJlciB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdCA9IGh0dHBzLnJlcXVlc3QodmFsaWRhdGVPcHRpb25zLCAocmVzcG9uc2UpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UucmVzdW1lKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKHsgaGVhZGVyczogcmVzcG9uc2UuaGVhZGVycywgc3RhdHVzQ29kZTogcmVzcG9uc2Uuc3RhdHVzQ29kZSB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5vbignZXJyb3InLCByZWplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaW5hbENvb2tpZXMgPSAodmFsaWRhdGVSZXNwb25zZS5oZWFkZXJzWydzZXQtY29va2llJ10gfHwgW10pLm1hcCgoYzogc3RyaW5nKSA9PiBjLnNwbGl0KCc7JylbMF0pLmpvaW4oJzsgJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxDID0gW2Nvb2tpZXNBZnRlclBvc3QsIGZpbmFsQ29va2llc10uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJzsgJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtSQ00gUHJveHldIFZhbGlkYXRlVXNlciBTdGF0dXM6ICR7dmFsaWRhdGVSZXNwb25zZS5zdGF0dXNDb2RlfWApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdMb2dpbiBTdWNjZXNzZnVsIChGaW5hbGl6ZWQpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWRpcmVjdDogdmFsaWRhdGVSZXNwb25zZS5oZWFkZXJzLmxvY2F0aW9uIHx8IGxvY2F0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvb2tpZXM6IGFsbENcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW1JDTSBQcm94eV0gTG9naW4gRmFpbGVkLiBSZWRpcmVjdGVkIHRvOiAke2xvY2F0aW9ufWApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQgZGlkbid0IHJlZGlyZWN0IHRvIHZhbGlkYXRldXNlciwgaXQgZmFpbGVkLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdMb2dpbiBGYWlsZWQ6IEludmFsaWQgQ3JlZGVudGlhbHMgb3IgU2Vzc2lvbi4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IGBSZWRpcmVjdGVkIHRvOiAke2xvY2F0aW9ufWAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29va2llczogYWxsQ29va2llc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1JDTSBQcm94eV0gRXJyb3I6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnJvci5tZXNzYWdlIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlcS51cmwgPT09ICcvYXBpL3JjbS1yZXNlcnZhdGlvbi1zZWFyY2gnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcm0gPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGJvZHkgPSAnJztcclxuICAgICAgICAgICAgICAgICAgICByZXEub24oJ2RhdGEnLCBjaHVuayA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHkgKz0gY2h1bmsudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxLm9uKCdlbmQnLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHJlZ28sIGNvb2tpZXMsIGRhdGVTdHIgfSA9IEpTT04ucGFyc2UoYm9keSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RlcCAxOiBHRVQgc2VhcmNoIHBhZ2UgdG8gZ2V0IFZpZXdTdGF0ZSAod2l0aCBSZWRpcmVjdCBIYW5kbGluZylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZldGNoV2l0aFJlZGlyZWN0cyA9IGFzeW5jIChob3N0bmFtZTogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGNvb2tpZXM6IHN0cmluZyk6IFByb21pc2U8eyBib2R5OiBzdHJpbmcsIGhlYWRlcnM6IGFueSB9PiA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRQYXRoID0gcGF0aDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgY3VycmVudEhvc3RuYW1lID0gaG9zdG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHJlZGlyZWN0Q291bnQgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1heFJlZGlyZWN0cyA9IDU7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlIChyZWRpcmVjdENvdW50IDwgbWF4UmVkaXJlY3RzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBob3N0bmFtZTogY3VycmVudEhvc3RuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogY3VycmVudFBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdDb29raWUnOiBjb29raWVzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNidcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgbmV3IFByb21pc2U8eyBib2R5OiBzdHJpbmcsIGhlYWRlcnM6IGFueSwgc3RhdHVzQ29kZT86IG51bWJlciB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXEgPSBodHRwcy5yZXF1ZXN0KG9wdGlvbnMsIChyZXMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5vbignZGF0YScsIChjaHVuaykgPT4gZGF0YSArPSBjaHVuayk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKHsgYm9keTogZGF0YSwgaGVhZGVyczogcmVzLmhlYWRlcnMsIHN0YXR1c0NvZGU6IHJlcy5zdGF0dXNDb2RlIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxLm9uKCdlcnJvcicsIHJlamVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXEuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGFuZGxlIFJlZGlyZWN0c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSAmJiBbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdLmluY2x1ZGVzKHJlc3BvbnNlLnN0YXR1c0NvZGUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2NhdGlvbiA9IHJlc3BvbnNlLmhlYWRlcnMubG9jYXRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9jYXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW1JDTSBQcm94eV0gUmVkaXJlY3RpbmcgdG86ICR7bG9jYXRpb259YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSGFuZGxlIHJlbGF0aXZlIG9yIGFic29sdXRlIFVSTHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9jYXRpb24uc3RhcnRzV2l0aCgnaHR0cCcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwobG9jYXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50SG9zdG5hbWUgPSB1cmwuaG9zdG5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRQYXRoID0gdXJsLnBhdGhuYW1lICsgdXJsLnNlYXJjaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50UGF0aCA9IGxvY2F0aW9uO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWRpcmVjdENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUb28gbWFueSByZWRpcmVjdHMnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2V0UmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhSZWRpcmVjdHMoJ2Jvb2tpbmdzLnJlbnRhbGNhcm1hbmFnZXIuY29tJywgJy9yZXBvcnQvcmVzZXJ2YXRpb25fZW5xdWlyeScsIGNvb2tpZXMpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgSGlkZGVuIEZpZWxkc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgdmlld1N0YXRlTWF0Y2ggPSBnZXRSZXNwb25zZS5ib2R5Lm1hdGNoKC9pZD1cIl9fVklFV1NUQVRFXCIgdmFsdWU9XCIoLio/KVwiLyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3U3RhdGVHZW5NYXRjaCA9IGdldFJlc3BvbnNlLmJvZHkubWF0Y2goL2lkPVwiX19WSUVXU1RBVEVHRU5FUkFUT1JcIiB2YWx1ZT1cIiguKj8pXCIvKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50VmFsaWRhdGlvbk1hdGNoID0gZ2V0UmVzcG9uc2UuYm9keS5tYXRjaCgvaWQ9XCJfX0VWRU5UVkFMSURBVElPTlwiIHZhbHVlPVwiKC4qPylcIi8pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdmlld1N0YXRlTWF0Y2gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBmaW5kIFZpZXdTdGF0ZSBvbiBzZWFyY2ggcGFnZS4gU2Vzc2lvbiBtYXkgYmUgZXhwaXJlZC4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3U3RhdGUgPSB2aWV3U3RhdGVNYXRjaFsxXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZpZXdTdGF0ZUdlbmVyYXRvciA9IHZpZXdTdGF0ZUdlbk1hdGNoID8gdmlld1N0YXRlR2VuTWF0Y2hbMV0gOiAnJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50VmFsaWRhdGlvbiA9IGV2ZW50VmFsaWRhdGlvbk1hdGNoID8gZXZlbnRWYWxpZGF0aW9uTWF0Y2hbMV0gOiAnJztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDI6IFBPU1QgU2VhcmNoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3RlOiBVc2VyIHByb3ZpZGVkIGV4YW1wbGUgaW1wbGllcyBzcGVjaWZpYyBmaWVsZHMuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0eHRTdGFydGluZ0RheTE5NyBhbmQgdHh0RW5kaW5nRGF5MTk3IHNlZW0gdG8gYmUgdGhlIGRhdGUgZmllbGRzLCBsaWtlbHkgZ2VuZXJhdGVkIElEcy5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIHdpbGwgdXNlIHRoZSBwcm92aWRlZCBkYXRlU3RyIChkZC9NTS95eXl5IGJhc2VkIG9uIGV4YW1wbGUgXCIzMS8wMS8yMDI2XCIpXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zdERhdGEgPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX0VWRU5UVEFSR0VUJzogJ2N0bDAwJE1haW5Cb2R5Q29udGVudCRidXRSdW5SZXBvcnQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX0VWRU5UQVJHVU1FTlQnOiAnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnX19WSUVXU1RBVEUnOiB2aWV3U3RhdGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ19fVklFV1NUQVRFR0VORVJBVE9SJzogdmlld1N0YXRlR2VuZXJhdG9yLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdfX0VWRU5UVkFMSURBVElPTic6IGV2ZW50VmFsaWRhdGlvbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc2VhcmNoZm9yJzogJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NtYlJlcG9ydExvY2F0aW9uSUQnOiAnMCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3R4dFN0YXJ0aW5nRGF5MTk3JzogZGF0ZVN0ciwgLy8gZS5nLiAzMS8wMS8yMDI2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3R4dEVuZGluZ0RheTE5Nyc6IGRhdGVTdHIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NtYnNTZWFyY2hGb3InOiAncmVnaXN0cmF0aW9ubm8nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0eHRzU2VhcmNoU3RyaW5nMTk3JzogcmVnbyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY21iQXBwbHlEYXRlUmF0ZSc6ICdBbGwnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdoaWRTZWVBbGxGbGVldCc6ICdZZXMnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdoaWRBY2Nlc3NMZXZlbCc6ICcxMDAnLCAvLyBBc3N1bWluZyBkZWZhdWx0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2hpZEJyYW5jaElEJzogJzknLCAgICAgIC8vIEFzc3VtaW5nIGRlZmF1bHQgb3IgbmVlZCB0byBleHRyYWN0PyBVc2luZyA5IGZyb20gZXhhbXBsZS5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQ29uZmlybWVkX2xlbmd0aCc6ICctMScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2N0bDAwJE1haW5Cb2R5Q29udGVudCRyZXBvcnRjb2RlJzogJ3Jlc2VydmF0aW9uX2VucXVpcnknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdGwwMCRNYWluQm9keUNvbnRlbnQkUGFnZU5vJzogJzAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdGwwMCRNYWluQm9keUNvbnRlbnQkSXRlbXNQZXJQYWdlJzogJzAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdGwwMCRNYWluQm9keUNvbnRlbnQkQXV0b0dlbmVyYXRlZCc6ICcwJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY3RsMDAkTWFpbkJvZHlDb250ZW50JFNlcnZlclNpZGUnOiAnRmFsc2UnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdGwwMCRNYWluQm9keUNvbnRlbnQkZnhkSGRyJzogJzEnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdGwwMCRNYWluQm9keUNvbnRlbnQkaGRuUmVwb3J0RGF0YSc6ICd7fScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2N0bDAwJE1haW5Cb2R5Q29udGVudCRoZG5TdW1tYXJ5RmllbGRzJzogJ3t9J1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zdE9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaG9zdG5hbWU6ICdib29raW5ncy5yZW50YWxjYXJtYW5hZ2VyLmNvbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogJy9yZXBvcnQvcmVzZXJ2YXRpb25fZW5xdWlyeScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdDb250ZW50LUxlbmd0aCc6IEJ1ZmZlci5ieXRlTGVuZ3RoKHBvc3REYXRhKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0Nvb2tpZSc6IGNvb2tpZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdVc2VyLUFnZW50JzogJ01vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMjAuMC4wLjAgU2FmYXJpLzUzNy4zNicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdPcmlnaW4nOiAnaHR0cHM6Ly9ib29raW5ncy5yZW50YWxjYXJtYW5hZ2VyLmNvbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdSZWZlcmVyJzogJ2h0dHBzOi8vYm9va2luZ3MucmVudGFsY2FybWFuYWdlci5jb20vcmVwb3J0L3Jlc2VydmF0aW9uX2VucXVpcnknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3N0UmVzcG9uc2UgPSBhd2FpdCBuZXcgUHJvbWlzZTx7IGJvZHk6IHN0cmluZywgc3RhdHVzQ29kZT86IG51bWJlciB9PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdCA9IGh0dHBzLnJlcXVlc3QocG9zdE9wdGlvbnMsIChyZXNwb25zZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YSA9ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZS5vbignZGF0YScsIChjaHVuaykgPT4gZGF0YSArPSBjaHVuayk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKHsgYm9keTogZGF0YSwgc3RhdHVzQ29kZTogcmVzcG9uc2Uuc3RhdHVzQ29kZSB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdC5vbignZXJyb3InLCByZWplY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3Qud3JpdGUocG9zdERhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3QuZW5kKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGVwIDM6IFBhcnNlIFJlc3VsdHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gZXh0cmFjdCB0YWJsZSByb3dzIGZyb20gPHRhYmxlIGlkPVwiQ29uZmlybWVkXCI+IC4uLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVnZXggdG8gZmluZCB0aGUgdGFibGUgYm9keSByb3dzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YWJsZU1hdGNoID0gcG9zdFJlc3BvbnNlLmJvZHkubWF0Y2goLzx0YWJsZVtePl0qaWQ9XCJDb25maXJtZWRcIltePl0qPihbXFxzXFxTXSo/KTxcXC90YWJsZT4vKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlcmZhY2UgUmVzZXJ2YXRpb25SZXN1bHQge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc05vOiBzdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VzdG9tZXI6IHN0cmluZztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZWhpY2xlOiBzdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiBzdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmF3SHRtbDogc3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IFJlc2VydmF0aW9uUmVzdWx0W10gPSBbXTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFibGVNYXRjaCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhYmxlQ29udGVudCA9IHRhYmxlTWF0Y2hbMV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVmVyeSBiYXNpYyByZWdleCBwYXJzaW5nIGZvciByb3dzLiBDaGVlcmlvIHdvdWxkIGJlIGJldHRlciBidXQga2VlcGluZyBkZXBzIGxvdy5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBMb29rIGZvciA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IHRhYmxlQ29udGVudC5tYXRjaCgvPHRyW1xcc1xcU10qPzxcXC90cj4vZyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyb3dzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MuZm9yRWFjaChyb3cgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2tpcCBoZWFkZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyb3cuaW5jbHVkZXMoJzx0aCcpKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBSZXMgTm8gKGluc2lkZSBmaXJzdCB0ZCwgdXN1YWxseSBpbiBhIGxhYmVsIHdpdGggb25jbGljaylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDxsYWJlbCBvbmNsaWNrPVwiUmVwb3J0UG9wdXAoJy9yZXBvcnQvYm9va2luZ2RldGFpbGxpbmsvaHRtbC8xMjQxMDAvYicsIDgwMCk7IFwiIC4uLj4xMjQxMDA8L2xhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzTm9NYXRjaCA9IHJvdy5tYXRjaCgvUmVwb3J0UG9wdXBcXCgnW14nXStcXC8oXFxkKylcXC8vKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc05vID0gcmVzTm9NYXRjaCA/IHJlc05vTWF0Y2hbMV0gOiAnJztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IEN1c3RvbWVyICg0dGggPHRkPiB1c3VhbGx5PylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJhc2VkIG9uIGV4YW1wbGU6IDx0ZCBjbGFzcz1cImxlZnRcIj5ESUFSTUFJRCBHQUxMQUdIRVI8YnI+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIExldCdzIGp1c3QgZ3JhYiBhbGwgY2VsbCBjb250ZW50c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2VsbHMgPSByb3cubWF0Y2goLzx0ZFtePl0qPihbXFxzXFxTXSo/KTxcXC90ZD4vZyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2VsbHMgJiYgY2VsbHMubGVuZ3RoID4gNCAmJiByZXNObykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vcm1hbGl6ZSB0ZXh0c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFuID0gKHM6IHN0cmluZykgPT4gcy5yZXBsYWNlKC88W14+XSs+L2csICcnKS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1c3RvbWVyID0gY2xlYW4oY2VsbHNbNF0pOyAvLyA1dGggY2VsbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlaGljbGUgPSBjbGVhbihjZWxsc1s2XSk7ICAvLyA3dGggY2VsbFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNObyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VzdG9tZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlaGljbGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJhd0h0bWw6IHJvdyAvLyBLZWVwIHJhdyBpZiBuZWVkZWQgZm9yIGRlYnVnPyBNYXliZSB0b28gYmlnLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCByZXN1bHRzIH0pKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdTZWFyY2ggUHJveHkgRXJyb3I6JywgZXJyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBlcnIubWVzc2FnZSB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG5leHQoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlYLFNBQVMsb0JBQW9CO0FBQ3RaLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7OztBQ0grWCxPQUFPLFlBQVk7QUFJbGIsT0FBTyxnQkFBZ0I7QUFDdkIsT0FBTyxRQUFROzs7QUNMMFksT0FBTyxnQkFBZ0I7QUFzQmhiLGVBQXNCLGlCQUFpQixTQUF1QjtBQUM1RCxRQUFNLEVBQUUsSUFBSSxJQUFJLFNBQVMsU0FBUyxTQUFTLFlBQVksTUFBTSxZQUFZLElBQUk7QUFHN0UsVUFBUSxLQUFLLENBQUMsR0FBUSxNQUFXLElBQUksS0FBSyxFQUFFLFNBQVMsRUFBRSxRQUFRLElBQUksSUFBSSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQztBQUdsRyxRQUFNLGFBQWEsQ0FBQ0EsYUFBb0I7QUFDdEMsV0FBTyxJQUFJLEtBQUtBLFFBQU8sRUFBRSxtQkFBbUIsQ0FBQyxHQUFHLEVBQUUsTUFBTSxXQUFXLFFBQVEsV0FBVyxRQUFRLE1BQU0sQ0FBQztBQUFBLEVBQ3ZHO0FBR0EsUUFBTSxZQUFZLFFBQVEsSUFBSSxDQUFDLE1BQVc7QUFBQTtBQUFBLGNBRTlCLEVBQUUsaUJBQWlCO0FBQUEsY0FDbkIsRUFBRSxJQUFJO0FBQUEsY0FDTixFQUFFLGFBQWEsUUFBUSxJQUFJO0FBQUEsZUFDMUIsRUFBRSxPQUFPLFFBQVEsQ0FBQyxDQUFDO0FBQUEsY0FDcEIsRUFBRSxXQUFXO0FBQUEsY0FD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
