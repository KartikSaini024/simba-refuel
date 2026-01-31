import type { Plugin, ViteDevServer } from 'vite';
import https from 'https';
import querystring from 'querystring';

export default function rcmProxyPlugin(): Plugin {
    return {
        name: 'vite-rcm-proxy',
        configureServer(server: ViteDevServer) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/test-rcm-login' && req.method === 'POST') {
                    console.log('[RCM Proxy] Starting login test...');

                    try {
                        // Step 1: GET the login page to fetch hidden fields and initial cookies
                        const getOptions = {
                            hostname: 'bookings.rentalcarmanager.com',
                            path: '/account/login.aspx',
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        };

                        const getResponse = await new Promise<{ body: string, headers: any }>((resolve, reject) => {
                            const request = https.request(getOptions, (response) => {
                                let data = '';
                                response.on('data', (chunk) => data += chunk);
                                response.on('end', () => resolve({ body: data, headers: response.headers }));
                            });
                            request.on('error', reject);
                            request.end();
                        });

                        // Extract Cookies
                        const initialCookies = (getResponse.headers['set-cookie'] || []).map((c: string) => c.split(';')[0]).join('; ');
                        console.log('[RCM Proxy] Initial cookies obtained');

                        // Extract Hidden Fields
                        const viewStateMatch = getResponse.body.match(/id="__VIEWSTATE" value="(.*?)"/);
                        const viewStateGenMatch = getResponse.body.match(/id="__VIEWSTATEGENERATOR" value="(.*?)"/);
                        const eventValidationMatch = getResponse.body.match(/id="__EVENTVALIDATION" value="(.*?)"/);

                        if (!viewStateMatch || !eventValidationMatch) {
                            throw new Error('Failed to parse validation fields from login page.');
                        }

                        const viewState = viewStateMatch[1];
                        const viewStateGenerator = viewStateGenMatch ? viewStateGenMatch[1] : '';
                        const eventValidation = eventValidationMatch[1];

                        // Step 2: POST credentials
                        const postData = querystring.stringify({
                            '__EVENTTARGET': '',
                            '__EVENTARGUMENT': '',
                            '__VIEWSTATE': viewState,
                            '__VIEWSTATEGENERATOR': viewStateGenerator,
                            '__EVENTVALIDATION': eventValidation,
                            'ctl00$MainContent$Username': 'devsimba',
                            'ctl00$MainContent$Password': 'Welcome5',
                            'ctl00$MainContent$LoginButton': 'Sign in' // The button value is often required in ASP.NET
                        });

                        const postOptions = {
                            hostname: 'bookings.rentalcarmanager.com',
                            path: '/account/login.aspx',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Content-Length': Buffer.byteLength(postData),
                                'Cookie': initialCookies,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Origin': 'https://bookings.rentalcarmanager.com',
                                'Referer': 'https://bookings.rentalcarmanager.com/account/login.aspx'
                            }
                        };

                        const postResponse = await new Promise<{ headers: any, statusCode?: number }>((resolve, reject) => {
                            const request = https.request(postOptions, (response) => {
                                // We typically just need the headers (Location / Set-Cookie), we don't necessarily need the body if it's a redirect
                                response.resume(); // Consume stream
                                response.on('end', () => resolve({ headers: response.headers, statusCode: response.statusCode }));
                            });
                            request.on('error', reject);
                            request.write(postData);
                            request.end();
                        });

                        // Step 3: Check Result
                        // A successful login usually redirects (302) to /account/validateuser.aspx or similar.
                        // Or it might just set new cookies.
                        console.log(`[RCM Proxy] Status Code: ${postResponse.statusCode}`);
                        const location = postResponse.headers.location || '';
                        const newCookies = (postResponse.headers['set-cookie'] || []).map((c: string) => c.split(';')[0]).join('; ');

                        // Combine cookies (simple merge)
                        const allCookies = [initialCookies, newCookies].filter(Boolean).join('; ');

                        if (postResponse.statusCode === 302 && location.toLowerCase().includes('validateuser')) {
                            console.log('[RCM Proxy] Login Verified: Redirecting to validateuser. Following redirect...');

                            // Follow the redirect to validateuser.aspx to ensure we get the final auth cookies
                            const cookiesAfterPost = [initialCookies, newCookies].filter(Boolean).join('; ');

                            const validatePath = location.startsWith('http') ? new URL(location).pathname : location;

                            const validateOptions = {
                                hostname: 'bookings.rentalcarmanager.com',
                                path: validatePath,
                                method: 'GET',
                                headers: {
                                    'Cookie': cookiesAfterPost,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            };

                            const validateResponse = await new Promise<{ headers: any, statusCode?: number }>((resolve, reject) => {
                                const request = https.request(validateOptions, (response) => {
                                    response.resume();
                                    response.on('end', () => resolve({ headers: response.headers, statusCode: response.statusCode }));
                                });
                                request.on('error', reject);
                                request.end();
                            });

                            const finalCookies = (validateResponse.headers['set-cookie'] || []).map((c: string) => c.split(';')[0]).join('; ');
                            const allC = [cookiesAfterPost, finalCookies].filter(Boolean).join('; ');

                            console.log(`[RCM Proxy] ValidateUser Status: ${validateResponse.statusCode}`);

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({
                                success: true,
                                message: 'Login Successful (Finalized)',
                                redirect: validateResponse.headers.location || location,
                                cookies: allC
                            }));
                        } else {
                            console.warn(`[RCM Proxy] Login Failed. Redirected to: ${location}`);
                            // If it didn't redirect to validateuser, it failed.
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({
                                success: false,
                                message: 'Login Failed: Invalid Credentials or Session.',
                                details: `Redirected to: ${location}`,
                                cookies: allCookies
                            }));
                        }

                    } catch (error: any) {
                        console.error('[RCM Proxy] Error:', error);
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: error.message }));
                    }
                } else if (req.url === '/api/rcm-reservation-search' && req.method === 'POST') {
                    const form = new URLSearchParams();
                    let body = '';
                    req.on('data', chunk => {
                        body += chunk.toString();
                    });

                    req.on('end', async () => {
                        try {
                            const { rego, cookies, dateStr } = JSON.parse(body);

                            // Step 1: GET search page to get ViewState (with Redirect Handling)
                            const fetchWithRedirects = async (hostname: string, path: string, cookies: string): Promise<{ body: string, headers: any }> => {
                                let currentPath = path;
                                let currentHostname = hostname;
                                let redirectCount = 0;
                                const maxRedirects = 5;

                                while (redirectCount < maxRedirects) {
                                    const options = {
                                        hostname: currentHostname,
                                        path: currentPath,
                                        method: 'GET',
                                        headers: {
                                            'Cookie': cookies,
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                        }
                                    };

                                    const response = await new Promise<{ body: string, headers: any, statusCode?: number }>((resolve, reject) => {
                                        const req = https.request(options, (res) => {
                                            let data = '';
                                            res.on('data', (chunk) => data += chunk);
                                            res.on('end', () => resolve({ body: data, headers: res.headers, statusCode: res.statusCode }));
                                        });
                                        req.on('error', reject);
                                        req.end();
                                    });

                                    // Handle Redirects
                                    if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
                                        const location = response.headers.location;
                                        if (location) {
                                            console.log(`[RCM Proxy] Redirecting to: ${location}`);
                                            // Handle relative or absolute URLs
                                            if (location.startsWith('http')) {
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
                                throw new Error('Too many redirects');
                            };

                            const getResponse = await fetchWithRedirects('bookings.rentalcarmanager.com', '/report/reservation_enquiry', cookies);

                            // Extract Hidden Fields
                            const viewStateMatch = getResponse.body.match(/id="__VIEWSTATE" value="(.*?)"/);
                            const viewStateGenMatch = getResponse.body.match(/id="__VIEWSTATEGENERATOR" value="(.*?)"/);
                            const eventValidationMatch = getResponse.body.match(/id="__EVENTVALIDATION" value="(.*?)"/);

                            if (!viewStateMatch) {
                                throw new Error('Failed to find ViewState on search page. Session may be expired.');
                            }

                            const viewState = viewStateMatch[1];
                            const viewStateGenerator = viewStateGenMatch ? viewStateGenMatch[1] : '';
                            const eventValidation = eventValidationMatch ? eventValidationMatch[1] : '';

                            // Step 2: POST Search
                            // Note: User provided example implies specific fields.
                            // txtStartingDay197 and txtEndingDay197 seem to be the date fields, likely generated IDs.
                            // We will use the provided dateStr (dd/MM/yyyy based on example "31/01/2026")

                            const postData = querystring.stringify({
                                '__EVENTTARGET': 'ctl00$MainBodyContent$butRunReport',
                                '__EVENTARGUMENT': '',
                                '__VIEWSTATE': viewState,
                                '__VIEWSTATEGENERATOR': viewStateGenerator,
                                '__EVENTVALIDATION': eventValidation,
                                'searchfor': '',
                                'cmbReportLocationID': '0',
                                'txtStartingDay197': dateStr, // e.g. 31/01/2026
                                'txtEndingDay197': dateStr,
                                'cmbsSearchFor': 'registrationno',
                                'txtsSearchString197': rego,
                                'cmbApplyDateRate': 'All',
                                'hidSeeAllFleet': 'Yes',
                                'hidAccessLevel': '100', // Assuming default
                                'hidBranchID': '9',      // Assuming default or need to extract? Using 9 from example.
                                'Confirmed_length': '-1',
                                'ctl00$MainBodyContent$reportcode': 'reservation_enquiry',
                                'ctl00$MainBodyContent$PageNo': '0',
                                'ctl00$MainBodyContent$ItemsPerPage': '0',
                                'ctl00$MainBodyContent$AutoGenerated': '0',
                                'ctl00$MainBodyContent$ServerSide': 'False',
                                'ctl00$MainBodyContent$fxdHdr': '1',
                                'ctl00$MainBodyContent$hdnReportData': '{}',
                                'ctl00$MainBodyContent$hdnSummaryFields': '{}'
                            });

                            const postOptions = {
                                hostname: 'bookings.rentalcarmanager.com',
                                path: '/report/reservation_enquiry',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'Content-Length': Buffer.byteLength(postData),
                                    'Cookie': cookies,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Origin': 'https://bookings.rentalcarmanager.com',
                                    'Referer': 'https://bookings.rentalcarmanager.com/report/reservation_enquiry'
                                }
                            };

                            const postResponse = await new Promise<{ body: string, statusCode?: number }>((resolve, reject) => {
                                const request = https.request(postOptions, (response) => {
                                    let data = '';
                                    response.on('data', (chunk) => data += chunk);
                                    response.on('end', () => resolve({ body: data, statusCode: response.statusCode }));
                                });
                                request.on('error', reject);
                                request.write(postData);
                                request.end();
                            });

                            // Step 3: Parse Results
                            // We need to extract table rows from <table id="Confirmed"> ...
                            // Regex to find the table body rows
                            const tableMatch = postResponse.body.match(/<table[^>]*id="Confirmed"[^>]*>([\s\S]*?)<\/table>/);

                            interface ReservationResult {
                                resNo: string;
                                customer: string;
                                vehicle: string;
                                rawHtml: string;
                            }

                            const results: ReservationResult[] = [];

                            if (tableMatch) {
                                const tableContent = tableMatch[1];
                                // Very basic regex parsing for rows. Cheerio would be better but keeping deps low.
                                // Look for <tr>
                                const rows = tableContent.match(/<tr[\s\S]*?<\/tr>/g);

                                if (rows) {
                                    rows.forEach(row => {
                                        // Skip header
                                        if (row.includes('<th')) return;

                                        // Extract Res No (inside first td, usually in a label with onclick)
                                        // <label onclick="ReportPopup('/report/bookingdetaillink/html/124100/b', 800); " ...>124100</label>
                                        const resNoMatch = row.match(/ReportPopup\('[^']+\/(\d+)\//);
                                        const resNo = resNoMatch ? resNoMatch[1] : '';

                                        // Extract Customer (4th <td> usually?)
                                        // Based on example: <td class="left">DIARMAID GALLAGHER<br></td>
                                        // Let's just grab all cell contents
                                        const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
                                        if (cells && cells.length > 4 && resNo) {
                                            // Normalize texts
                                            const clean = (s: string) => s.replace(/<[^>]+>/g, '').trim();

                                            const customer = clean(cells[4]); // 5th cell
                                            const vehicle = clean(cells[6]);  // 7th cell

                                            results.push({
                                                resNo,
                                                customer,
                                                vehicle,
                                                rawHtml: row // Keep raw if needed for debug? Maybe too big.
                                            });
                                        }
                                    });
                                }
                            }

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true, results }));

                        } catch (err: any) {
                            console.error('Search Proxy Error:', err);
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
