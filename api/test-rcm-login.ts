import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import querystring from 'querystring';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    console.log('[RCM API] Starting login test...');

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
        const rcmUsername = process.env.RCM_USERNAME;
        const rcmPassword = process.env.RCM_PASSWORD;

        if (!rcmUsername || !rcmPassword) {
            console.error('[RCM API] Missing RCM_USERNAME or RCM_PASSWORD env vars');
            return res.status(500).json({
                success: false,
                message: 'Server Configuration Error: Missing RCM Credentials'
            });
        }

        const postData = querystring.stringify({
            '__EVENTTARGET': '',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': viewState,
            '__VIEWSTATEGENERATOR': viewStateGenerator,
            '__EVENTVALIDATION': eventValidation,
            'ctl00$MainContent$Username': rcmUsername,
            'ctl00$MainContent$Password': rcmPassword,
            'ctl00$MainContent$LoginButton': 'Sign in'
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
                response.resume(); // Consume stream
                response.on('end', () => resolve({ headers: response.headers, statusCode: response.statusCode }));
            });
            request.on('error', reject);
            request.write(postData);
            request.end();
        });

        // Step 3: Check Result
        const location = postResponse.headers.location || '';
        const newCookies = (postResponse.headers['set-cookie'] || []).map((c: string) => c.split(';')[0]).join('; ');

        const allCookies = [initialCookies, newCookies].filter(Boolean).join('; ');

        if (postResponse.statusCode === 302 && location.toLowerCase().includes('validateuser')) {
            console.log('[RCM API] Login Verified: Redirecting to validateuser. Following redirect...');

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

            return res.status(200).json({
                success: true,
                message: 'Login Successful (Finalized)',
                redirect: validateResponse.headers.location || location,
                cookies: allC
            });
        } else {
            console.warn(`[RCM API] Login Failed. Redirected to: ${location}`);
            return res.status(200).json({
                success: false,
                message: 'Login Failed: Invalid Credentials or Session.',
                details: `Redirected to: ${location}`,
                cookies: allCookies
            });
        }

    } catch (error: any) {
        console.error('[RCM API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
