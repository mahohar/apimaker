import type { CapturedPattern } from '../types/api';

export interface PhpGeneratorConfig {
  baseUrl: string;
  sampleItemUrl?: string;
  capturedJsonText?: string;
  capturedPattern?: CapturedPattern;
  detectedQueryParam?: string;
  searchActionUrl?: string;
}

function escapePhpSingleQuote(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function deriveHostOrigin(rawUrl: string): string {
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl.trim())
      ? rawUrl.trim()
      : `https://${rawUrl.trim()}`;
    return new URL(withScheme).origin;
  } catch {
    return 'https://example.com';
  }
}

function detectXhrEndpointFromInput(rawText?: string, pattern?: CapturedPattern): {
  xhrUrl: string;
  method: 'GET' | 'POST';
  postJson: string;
} {
  if (pattern?.kind === 'json-api' && (pattern.staticUrlTemplate || pattern.baseUrl)) {
    return {
      xhrUrl: pattern.staticUrlTemplate || pattern.baseUrl,
      method: pattern.method || 'GET',
      postJson: pattern.postBodyTemplate || '',
    };
  }
  if (rawText) {
    const urlMatch = rawText.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch && /(api|graphql|wp-json|search|json)/i.test(urlMatch[0])) {
      return {
        xhrUrl: urlMatch[0],
        method: rawText.trimStart().startsWith('{') ? 'POST' : 'GET',
        postJson: rawText.trimStart().startsWith('{') ? rawText.trim().slice(0, 1000) : '',
      };
    }
  }
  return { xhrUrl: '', method: 'GET', postJson: '' };
}

export function generateStandalonePhpApi(config: PhpGeneratorConfig): {
  phpCode: string;
  callingUrls: {
    latest: string;
    search: string;
    shortcutId: string;
    detail: string;
    proxy: string;
  };
  jsSnippet: string;
} {
  const cleanBaseUrl = (config.baseUrl || 'https://example.com').trim();
  const origin = deriveHostOrigin(cleanBaseUrl);
  const queryParam = (
    config.capturedPattern?.queryParam ||
    config.detectedQueryParam ||
    's'
  ).trim() || 's';
  const searchBase = (
    config.capturedPattern?.staticUrlTemplate ||
    config.capturedPattern?.baseUrl ||
    config.searchActionUrl ||
    origin
  ).trim();
  const sampleItemUrl = (config.sampleItemUrl || cleanBaseUrl).trim();
  const xhrMeta = detectXhrEndpointFromInput(config.capturedJsonText, config.capturedPattern);

  const staticTemplate = (
    config.capturedPattern?.staticUrlTemplate ||
    xhrMeta.xhrUrl ||
    cleanBaseUrl
  ).trim();

  const demoFallbackQ = (config.capturedPattern?.sampleQuery || 'python').trim();
  const demoFallbackId = (config.capturedPattern?.sampleId || '12345').trim();
  const demoFallbackPage = (config.capturedPattern?.samplePage || '1').trim();

  const routeLatestTemplate = (config.capturedPattern?.multiRoutes?.latestUrl || cleanBaseUrl).trim();
  const routeSearchTemplate = (config.capturedPattern?.multiRoutes?.searchUrl || staticTemplate).trim();
  const routeDetailTemplate = (config.capturedPattern?.multiRoutes?.detailUrl || staticTemplate).trim();

  const phpBase = escapePhpSingleQuote(cleanBaseUrl);
  const phpOrigin = escapePhpSingleQuote(origin);
  const phpSearchBase = escapePhpSingleQuote(searchBase);
  const phpStaticTemplate = escapePhpSingleQuote(staticTemplate);
  const phpQueryParam = escapePhpSingleQuote(queryParam);
  const phpXhrUrl = escapePhpSingleQuote(xhrMeta.xhrUrl);
  const phpXhrMethod = escapePhpSingleQuote(xhrMeta.method);
  const phpPostTemplate = escapePhpSingleQuote(xhrMeta.postJson);
  const phpDemoQ = escapePhpSingleQuote(demoFallbackQ);
  const phpDemoId = escapePhpSingleQuote(demoFallbackId);
  const phpDemoPage = escapePhpSingleQuote(demoFallbackPage);
  const phpRouteLatest = escapePhpSingleQuote(routeLatestTemplate);
  const phpRouteSearch = escapePhpSingleQuote(routeSearchTemplate);
  const phpRouteDetail = escapePhpSingleQuote(routeDetailTemplate);

  const capturedReqHeaders = config.capturedPattern?.requestHeaders || {};
  const phpCustomOrigin = escapePhpSingleQuote(
    capturedReqHeaders.Origin || capturedReqHeaders.origin || origin
  );
  const phpCustomReferer = escapePhpSingleQuote(
    capturedReqHeaders.Referer || capturedReqHeaders.referer || `${origin}/`
  );
  const phpCustomAuth = escapePhpSingleQuote(
    capturedReqHeaders.Authorization ||
      capturedReqHeaders.authorization ||
      capturedReqHeaders['X-Api-Key'] ||
      capturedReqHeaders['x-api-key'] ||
      ''
  );
  const phpCustomUA = escapePhpSingleQuote(
    capturedReqHeaders['User-Agent'] ||
      capturedReqHeaders['user-agent'] ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  );

  const phpCode = `<?php
/**
 * Site2API Dynamic Universal Backend (Website + Mobile App + Telegram Bot Ready)
 * Part A (Static Templates) + Part B (Dynamic Variables & Demo Fallbacks)
 * Auto URL-Encoding, Relative-to-Absolute Asset Fix, time() Timestamp & Multi-Route Support
 * Generated for: ${cleanBaseUrl}
 */

error_reporting(0);
ini_set('display_errors', '0');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Range');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// =========================================================================
// PART A: STATIC TEMPLATES & CONFIGURABLE AUTH (Edit Token Here If Needed)
// =========================================================================
define('TARGET_BASE_URL', '${phpBase}');
define('TARGET_ORIGIN', '${phpOrigin}');
define('TARGET_SEARCH_URL', '${phpSearchBase}');
define('STATIC_URL_TEMPLATE', '${phpStaticTemplate}');
define('TARGET_QUERY_PARAM', '${phpQueryParam}');
define('CAPTURED_XHR_URL', '${phpXhrUrl}');
define('CAPTURED_XHR_METHOD', '${phpXhrMethod}');
define('CAPTURED_POST_BODY', '${phpPostTemplate}');
define('CAPTURED_ORIGIN', '${phpCustomOrigin}');
define('CAPTURED_REFERER', '${phpCustomReferer}');
define('API_AUTH_TOKEN', '${phpCustomAuth}');
define('CAPTURED_UA', '${phpCustomUA}');

// Multi-Route Templates (?action=latest | ?action=search | ?action=detail)
define('ROUTE_LATEST_TEMPLATE', '${phpRouteLatest}');
define('ROUTE_SEARCH_TEMPLATE', '${phpRouteSearch}');
define('ROUTE_DETAIL_TEMPLATE', '${phpRouteDetail}');

// =========================================================================
// PART B: DEMO FALLBACK VARIABLES (Used Only When No Input Is Passed)
// =========================================================================
define('DEMO_FALLBACK_Q', '${phpDemoQ}');
define('DEMO_FALLBACK_ID', '${phpDemoId}');
define('DEMO_FALLBACK_PAGE', '${phpDemoPage}');

/**
 * Normalize relative (/images/thumb.jpg) or protocol-relative (//cdn...) URLs to absolute https://
 */
function normalizeUrl($rawUrl, $baseUrl = TARGET_BASE_URL) {
    $rawUrl = trim((string)$rawUrl);
    if ($rawUrl === '' || strpos($rawUrl, 'javascript:') === 0 || strpos($rawUrl, 'data:') === 0 || $rawUrl[0] === '#') {
        return '';
    }
    if (strpos($rawUrl, '//') === 0) {
        return 'https:' . $rawUrl;
    }
    if (preg_match('#^https?://#i', $rawUrl)) {
        return $rawUrl;
    }
    $parts = parse_url($baseUrl);
    $scheme = $parts['scheme'] ?? 'https';
    $host = $parts['host'] ?? '';
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';
    $root = $host ? ($scheme . '://' . $host . $port) : TARGET_ORIGIN;

    if ($rawUrl[0] === '/') {
        return $root . $rawUrl;
    }
    $path = $parts['path'] ?? '/';
    $dir = rtrim(str_replace('\\\\', '/', dirname($path)), '/');
    return $root . ($dir ? $dir : '') . '/' . ltrim($rawUrl, './');
}

/**
 * Rule 2.2: Recursively convert relative asset/link paths inside upstream JSON into absolute URLs
 */
function normalizeJsonAssetsRecursively(&$node, $sourceBaseUrl, $currentKey = '') {
    if (!is_array($node)) return;
    foreach ($node as $k => &$val) {
        if (is_array($val)) {
            normalizeJsonAssetsRecursively($val, $sourceBaseUrl, (string)$k);
        } elseif (is_string($val)) {
            $trimmed = trim($val);
            if ($trimmed === '') continue;
            $looksRelativePath = ($trimmed[0] === '/' && strpos($trimmed, '//') !== 0)
                || preg_match('#^[^\\s]+\\.(jpg|jpeg|png|webp|gif|avif|mp4|m3u8|mkv|pdf|zip)(\\?.*)?$#i', $trimmed);
            $isAssetKey = preg_match('#(poster|thumb|thumbnail|image|cover|backdrop|avatar|url|link|stream|dl|file|src|download)#i', (string)$k);
            if ($looksRelativePath && ($trimmed[0] === '/' || $isAssetKey)) {
                $val = normalizeUrl($trimmed, $sourceBaseUrl);
            } elseif (strpos($trimmed, '//') === 0) {
                $val = 'https:' . $trimmed;
            }
        }
    }
}

/**
 * Rule 1 & Rule 2.1 & 2.3: Substitute {id}, {slug}, {q}, {page}, and {timestamp} (time()) safely with urlencode()
 */
function buildTemplatedUrl($template, $vars) {
    $qVal = urlencode((string)($vars['q'] ?? DEMO_FALLBACK_Q));
    $idVal = urlencode((string)($vars['id'] ?? DEMO_FALLBACK_ID));
    $pageVal = urlencode((string)($vars['page'] ?? DEMO_FALLBACK_PAGE));
    $tsVal = (string)time();

    $replacements = array(
        '{q}' => $qVal,
        '{{QUERY}}' => $qVal,
        '{id}' => $idVal,
        '{slug}' => $idVal,
        '{page}' => $pageVal,
        '{timestamp}' => $tsVal,
        '{ts}' => $tsVal,
    );
    $built = strtr($template, $replacements);

    // Also refresh any literal 10-digit Unix timestamp query param (?t=1795...) dynamically
    $built = preg_replace('/([?&](?:t|ts|timestamp|_)=)\\d{10,13}/i', '$1' . $tsVal, $built);
    return $built;
}

/**
 * Rule 2.1: Safely construct POST JSON payload with json_encode() escaping
 */
function buildTemplatedPostBody($template, $vars) {
    if ($template === '') return '';
    $qRaw = (string)($vars['q'] ?? DEMO_FALLBACK_Q);
    $idRaw = (string)($vars['id'] ?? DEMO_FALLBACK_ID);
    $pageRaw = (string)($vars['page'] ?? DEMO_FALLBACK_PAGE);
    $tsVal = (string)time();

    $decoded = json_decode($template, true);
    if (is_array($decoded)) {
        array_walk_recursive($decoded, function (&$item) use ($qRaw, $idRaw, $pageRaw, $tsVal) {
            if (is_string($item)) {
                if ($item === '{q}' || $item === '{{QUERY}}') $item = $qRaw;
                elseif ($item === '{id}' || $item === '{slug}') $item = $idRaw;
                elseif ($item === '{page}') $item = $pageRaw;
                elseif ($item === '{timestamp}' || $item === '{ts}') $item = $tsVal;
            }
        });
        return json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    return strtr($template, array(
        '{q}' => addslashes($qRaw),
        '{{QUERY}}' => addslashes($qRaw),
        '{id}' => addslashes($idRaw),
        '{page}' => addslashes($pageRaw),
        '{timestamp}' => $tsVal,
    ));
}

/**
 * Resilient cURL Client with Browser Headers, Auto Gzip/Brotli/Zstd Decoding & Redirects
 */
function curlRequest($url, $method = 'GET', $body = null, $extraHeaders = array()) {
    $ch = curl_init();
    $uParts = parse_url($url);
    $dynamicOrigin = (!empty($uParts['scheme']) && !empty($uParts['host']))
        ? ($uParts['scheme'] . '://' . $uParts['host'] . (isset($uParts['port']) ? ':' . $uParts['port'] : ''))
        : TARGET_ORIGIN;
    $originHeader = CAPTURED_ORIGIN !== '' ? CAPTURED_ORIGIN : $dynamicOrigin;
    $refererHeader = CAPTURED_REFERER !== '' ? CAPTURED_REFERER : ($dynamicOrigin . '/');

    $headers = array(
        'User-Agent: ' . CAPTURED_UA,
        'Accept: application/json, text/html, application/xhtml+xml, */*;q=0.9',
        'Origin: ' . $originHeader,
        'Referer: ' . $refererHeader
    );
    if (API_AUTH_TOKEN !== '') {
        $headers[] = 'Authorization: ' . API_AUTH_TOKEN;
    }
    $headers = array_merge($headers, $extraHeaders);

    curl_setopt_array($ch, array(
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 8,
        CURLOPT_ENCODING => '',
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER => $headers
    ));

    if (strtoupper($method) === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($body) ? json_encode($body) : $body);
        }
    }

    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $finalUrl = (string)curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $err = curl_error($ch);
    curl_close($ch);

    return array(
        'ok' => ($response !== false && $status >= 200 && $status < 400),
        'status' => $status,
        'content_type' => $contentType,
        'final_url' => $finalUrl ?: $url,
        'body' => $response === false ? '' : $response,
        'error' => $err
    );
}

/**
 * Media & Asset Relay with HTTP Range Support (Video Seeking)
 */
if (isset($_GET['proxy']) && trim($_GET['proxy']) !== '') {
    $mediaUrl = normalizeUrl($_GET['proxy']);
    if (!$mediaUrl || !preg_match('#^https?://#i', $mediaUrl)) {
        header('Content-Type: application/json; charset=UTF-8');
        http_response_code(400);
        echo json_encode(array('status' => false, 'error' => 'Invalid proxy URL'), JSON_UNESCAPED_SLASHES);
        exit;
    }

    $ch = curl_init($mediaUrl);
    $reqHeaders = array(
        'User-Agent: ' . CAPTURED_UA,
        'Referer: ' . TARGET_ORIGIN . '/',
        'Accept: */*'
    );
    if (!empty($_SERVER['HTTP_RANGE'])) {
        $reqHeaders[] = 'Range: ' . $_SERVER['HTTP_RANGE'];
    }

    curl_setopt_array($ch, array(
        CURLOPT_HTTPHEADER => $reqHeaders,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_HEADERFUNCTION => function($curl, $headerLine) {
            $len = strlen($headerLine);
            $parts = explode(':', $headerLine, 2);
            if (count($parts) === 2) {
                $name = strtolower(trim($parts[0]));
                $val = trim($parts[1]);
                if (in_array($name, array('content-type', 'content-length', 'content-range', 'accept-ranges'), true)) {
                    header($parts[0] . ': ' . $val);
                }
            }
            if (stripos($headerLine, 'HTTP/') === 0 && preg_match('#\\s(200|206)\\s#', $headerLine, $m)) {
                http_response_code((int)$m[1]);
            }
            return $len;
        },
        CURLOPT_WRITEFUNCTION => function($curl, $chunk) {
            echo $chunk;
            if (ob_get_level() > 0) {
                @ob_flush();
            }
            flush();
            return strlen($chunk);
        }
    ));

    curl_exec($ch);
    curl_close($ch);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

function jsonOut($payload, $code = 200) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function extractEmbeddedJsonObjects($html) {
    $objects = array();
    if (preg_match('#<script[^>]*id=["\\\']__NEXT_DATA__["\\\'][^>]*>(.*?)</script>#is', $html, $m)) {
        $decoded = json_decode(html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8'), true);
        if (is_array($decoded)) $objects[] = $decoded;
    }
    if (preg_match_all('#<script[^>]*type=["\\\']application/ld\\+json["\\\'][^>]*>(.*?)</script>#is', $html, $matches)) {
        foreach ($matches[1] as $raw) {
            $decoded = json_decode(trim($raw), true);
            if (is_array($decoded)) $objects[] = $decoded;
        }
    }
    if (preg_match_all('#(?:window\\.__INITIAL_STATE__|window\\.__PRELOADED_STATE__|window\\.__NUXT__|ytInitialData)\\s*=\\s*(\\{.*?\\});#is', $html, $jsMatches)) {
        foreach ($jsMatches[1] as $raw) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $objects[] = $decoded;
        }
    }
    return $objects;
}

function harvestFromJsonNode($node, $baseUrl, &$results, &$streams, &$downloads, &$seen) {
    if (!is_array($node)) return;

    $isAssoc = array_keys($node) !== range(0, count($node) - 1);
    if ($isAssoc) {
        $title = $node['title'] ?? $node['name'] ?? $node['headline'] ?? '';
        $link = $node['url'] ?? $node['link'] ?? $node['href'] ?? $node['slug'] ?? '';
        $poster = $node['poster'] ?? $node['thumbnail'] ?? $node['image'] ?? $node['cover'] ?? '';
        $desc = $node['description'] ?? $node['summary'] ?? $node['excerpt'] ?? '';
        $streamUrl = $node['stream'] ?? $node['streamUrl'] ?? $node['file'] ?? $node['src'] ?? $node['videoUrl'] ?? '';

        if (is_string($streamUrl) && preg_match('#\\.(mp4|m3u8|webm|mov)(\\?|$)#i', $streamUrl)) {
            $abs = normalizeUrl($streamUrl, $baseUrl);
            if ($abs && empty($seen['stream:' . $abs])) {
                $seen['stream:' . $abs] = true;
                $type = stripos($abs, '.m3u8') !== false ? 'm3u8' : 'mp4';
                $streams[] = array(
                    'server' => (string)($node['label'] ?? $node['quality'] ?? 'JSON Stream'),
                    'type' => $type,
                    'url' => $abs
                );
            }
        }

        if (is_string($title) && trim($title) !== '' && is_string($link) && trim($link) !== '') {
            $absLink = normalizeUrl($link, $baseUrl);
            if ($absLink && empty($seen['res:' . $absLink])) {
                $seen['res:' . $absLink] = true;
                $results[] = array(
                    'title' => trim(strip_tags($title)),
                    'url' => $absLink,
                    'poster' => is_string($poster) ? normalizeUrl($poster, $baseUrl) : '',
                    'badge' => (string)($node['badge'] ?? $node['category'] ?? $node['quality'] ?? ''),
                    'description' => trim(strip_tags((string)$desc))
                );
            }
        }
    }

    foreach ($node as $val) {
        if (is_array($val)) {
            harvestFromJsonNode($val, $baseUrl, $results, $streams, $downloads, $seen);
        } elseif (is_string($val) && preg_match('#https?://[^\\s"\']+\\.(mp4|m3u8|pdf|zip|mkv)(\\?[^\\s"\']*)?#i', $val, $m)) {
            $abs = normalizeUrl($m[0], $baseUrl);
            $ext = strtolower($m[1]);
            if (in_array($ext, array('mp4', 'm3u8'), true) && empty($seen['stream:' . $abs])) {
                $seen['stream:' . $abs] = true;
                $streams[] = array('server' => 'JSON Auto Server', 'type' => $ext, 'url' => $abs);
            } elseif (in_array($ext, array('pdf', 'zip', 'mkv'), true) && empty($seen['dl:' . $abs])) {
                $seen['dl:' . $abs] = true;
                $downloads[] = array(
                    'label' => basename(parse_url($abs, PHP_URL_PATH) ?: 'Download'),
                    'quality' => strtoupper($ext),
                    'size' => '',
                    'server' => 'Direct',
                    'url' => $abs
                );
            }
        }
    }
}

function createXPath($html) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="utf-8" ?>' . $html);
    libxml_clear_errors();
    return array($dom, new DOMXPath($dom));
}

function parseListPage($rawBody, $pageUrl, $pageNum, $isJson = false) {
    $results = array();
    $streams = array();
    $downloads = array();
    $seen = array();
    $hasNext = false;

    if ($isJson) {
        $decoded = json_decode($rawBody, true);
        if (is_array($decoded)) {
            normalizeJsonAssetsRecursively($decoded, $pageUrl);
            harvestFromJsonNode($decoded, $pageUrl, $results, $streams, $downloads, $seen);
            $hasNext = !empty($decoded['has_next']) || !empty($decoded['next_page']) || count($results) >= 10;
            return array('results' => $results, 'has_next' => $hasNext, 'raw' => $decoded);
        }
    }

    foreach (extractEmbeddedJsonObjects($rawBody) as $obj) {
        normalizeJsonAssetsRecursively($obj, $pageUrl);
        harvestFromJsonNode($obj, $pageUrl, $results, $streams, $downloads, $seen);
    }

    list($dom, $xpath) = createXPath($rawBody);
    $cardNodes = $xpath->query('//article | //*[contains(@class,"card")] | //*[contains(@class,"post")] | //*[contains(@class,"item")] | //*[contains(@class,"course")] | //*[contains(@class,"product_pod")]');

    if ($cardNodes && $cardNodes->length > 0) {
        foreach ($cardNodes as $card) {
            $linkNode = $xpath->query('.//a[@href]', $card)->item(0);
            if (!$linkNode) continue;
            $href = normalizeUrl($linkNode->getAttribute('href'), $pageUrl);
            if (!$href || isset($seen['res:' . $href])) continue;

            $titleNode = $xpath->query('.//h1 | .//h2 | .//h3 | .//h4 | .//*[contains(@class,"title")]', $card)->item(0);
            $title = trim(preg_replace('/\\s+/', ' ', $titleNode ? $titleNode->textContent : $linkNode->textContent));
            if ($title === '' || strlen($title) < 2) continue;

            $imgNode = $xpath->query('.//img', $card)->item(0);
            $poster = $imgNode ? normalizeUrl($imgNode->getAttribute('data-src') ?: $imgNode->getAttribute('src'), $pageUrl) : '';
            $descNode = $xpath->query('.//p | .//*[contains(@class,"desc")] | .//*[contains(@class,"summary")]', $card)->item(0);
            $badgeNode = $xpath->query('.//*[contains(@class,"badge")] | .//*[contains(@class,"quality")] | .//*[contains(@class,"price")]', $card)->item(0);

            $seen['res:' . $href] = true;
            $results[] = array(
                'title' => $title,
                'url' => $href,
                'poster' => $poster,
                'badge' => $badgeNode ? trim(preg_replace('/\\s+/', ' ', $badgeNode->textContent)) : '',
                'description' => $descNode ? trim(preg_replace('/\\s+/', ' ', $descNode->textContent)) : ''
            );
        }
    }

    $nextNode = $xpath->query('//a[@rel="next"] | //a[contains(translate(text(),"NEXT","next"),"next")] | //a[contains(@class,"next")]')->item(0);
    $hasNext = $nextNode !== null;

    return array('results' => $results, 'has_next' => $hasNext, 'raw' => null);
}

function parseDetailPage($rawBody, $itemUrl, $isJson = false) {
    $results = array();
    $streams = array();
    $downloads = array();
    $seen = array();
    $meta = array();
    $title = '';
    $poster = '';
    $description = '';
    $rawDecoded = null;

    if ($isJson) {
        $decoded = json_decode($rawBody, true);
        if (is_array($decoded)) {
            normalizeJsonAssetsRecursively($decoded, $itemUrl);
            $rawDecoded = $decoded;
            harvestFromJsonNode($decoded, $itemUrl, $results, $streams, $downloads, $seen);
            $title = (string)($decoded['title'] ?? $decoded['name'] ?? $decoded['headline'] ?? 'Item Details');
            $poster = normalizeUrl((string)($decoded['poster'] ?? $decoded['thumbnail'] ?? $decoded['image'] ?? ''), $itemUrl);
            $description = (string)($decoded['description'] ?? $decoded['overview'] ?? $decoded['summary'] ?? '');
        }
    } else {
        foreach (extractEmbeddedJsonObjects($rawBody) as $obj) {
            normalizeJsonAssetsRecursively($obj, $itemUrl);
            harvestFromJsonNode($obj, $itemUrl, $results, $streams, $downloads, $seen);
        }

        list($dom, $xpath) = createXPath($rawBody);
        $ogTitle = $xpath->query('//meta[@property="og:title"]/@content')->item(0);
        $h1Node = $xpath->query('//h1')->item(0);
        $titleNode = $xpath->query('//title')->item(0);
        $title = trim($ogTitle ? $ogTitle->textContent : ($h1Node ? $h1Node->textContent : ($titleNode ? $titleNode->textContent : 'Item Details')));

        $ogImg = $xpath->query('//meta[@property="og:image"]/@content')->item(0);
        $firstImg = $xpath->query('//main//img | //article//img | //img')->item(0);
        $poster = normalizeUrl($ogImg ? $ogImg->textContent : ($firstImg ? ($firstImg->getAttribute('data-src') ?: $firstImg->getAttribute('src')) : ''), $itemUrl);

        $ogDesc = $xpath->query('//meta[@name="description"]/@content | //meta[@property="og:description"]/@content')->item(0);
        $firstP = $xpath->query('//main//p | //article//p | //p')->item(0);
        $description = trim(preg_replace('/\\s+/', ' ', $ogDesc ? $ogDesc->textContent : ($firstP ? $firstP->textContent : '')));

        foreach ($xpath->query('//video | //video/source') as $vNode) {
            $src = normalizeUrl($vNode->getAttribute('src') ?: $vNode->getAttribute('data-src'), $itemUrl);
            if ($src && empty($seen['stream:' . $src])) {
                $seen['stream:' . $src] = true;
                $type = stripos($src, '.m3u8') !== false ? 'm3u8' : 'mp4';
                $streams[] = array('server' => 'HTML5 Server', 'type' => $type, 'url' => $src);
            }
        }

        foreach ($xpath->query('//iframe') as $iIdx => $fNode) {
            $src = normalizeUrl($fNode->getAttribute('src') ?: $fNode->getAttribute('data-src'), $itemUrl);
            if ($src && empty($seen['stream:' . $src])) {
                $seen['stream:' . $src] = true;
                $streams[] = array('server' => 'Embed Server ' . ($iIdx + 1), 'type' => 'embed', 'url' => $src);
            }
        }

        if (preg_match_all('#https?://[^\\s"\'\\\\<>]+\\.(mp4|m3u8|webm|mov)(\\?[^\\s"\'\\\\<>]*)?#i', $rawBody, $mAll)) {
            foreach ($mAll[0] as $idx => $rawStream) {
                $abs = normalizeUrl(str_replace('\\\\/', '/', $rawStream), $itemUrl);
                if ($abs && empty($seen['stream:' . $abs])) {
                    $seen['stream:' . $abs] = true;
                    $ext = strtolower($mAll[1][$idx]);
                    $streams[] = array(
                        'server' => 'Player Stream ' . (count($streams) + 1),
                        'type' => $ext === 'm3u8' ? 'm3u8' : 'mp4',
                        'url' => $abs
                    );
                }
            }
        }

        foreach ($xpath->query('//a[@href]') as $aNode) {
            $href = normalizeUrl($aNode->getAttribute('href'), $itemUrl);
            if (!$href || isset($seen['dl:' . $href])) continue;
            $label = trim(preg_replace('/\\s+/', ' ', $aNode->textContent)) ?: 'Download File';
            $isDownload = $aNode->hasAttribute('download') || preg_match('#\\.(pdf|zip|rar|mkv|mp4|doc|docx|ppt|pptx|epub)(\\?|$)#i', $href);
            if ($isDownload) {
                $seen['dl:' . $href] = true;
                $quality = preg_match('/(2160p|4k|1080p|720p|480p|360p|pdf|zip)/i', $label . ' ' . $href, $qm) ? strtoupper($qm[1]) : 'Direct';
                $size = preg_match('/(\\d+(?:\\.\\d+)?\\s*(?:GB|MB|KB))/i', $label, $sm) ? $sm[1] : '';
                $downloads[] = array(
                    'label' => $label,
                    'quality' => $quality,
                    'size' => $size,
                    'server' => parse_url($href, PHP_URL_HOST) ?: 'Direct',
                    'url' => $href
                );
            }
        }
        $meta['Source'] = parse_url($itemUrl, PHP_URL_HOST) ?: TARGET_ORIGIN;
    }

    $detailOut = array(
        'status' => true,
        'mode' => 'detail',
        'info' => array(
            'title' => $title,
            'poster' => $poster,
            'description' => $description,
            'meta' => (object)$meta
        ),
        'streams' => $streams,
        'downloads' => $downloads
    );
    if ($rawDecoded !== null) {
        $detailOut['raw'] = $rawDecoded;
    }
    return $detailOut;
}

// Parse GET query parameters or POST JSON body
$rawInput = file_get_contents('php://input');
$postJson = ($rawInput && trim($rawInput) !== '') ? json_decode($rawInput, true) : array();
if (!is_array($postJson)) $postJson = array();

$action = strtolower(trim((string)($_GET['action'] ?? $postJson['action'] ?? '')));
$itemUrl = trim((string)($_GET['url'] ?? $postJson['url'] ?? ''));
$shortcutId = trim((string)($_GET['id'] ?? $postJson['id'] ?? ''));
$query = trim((string)($_GET['q'] ?? $_GET['query'] ?? $postJson['q'] ?? $postJson['query'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? $postJson['page'] ?? DEMO_FALLBACK_PAGE));

$isDemoFallback = ($action === '' && $itemUrl === '' && $shortcutId === '' && $query === '');
$vars = array(
    'q' => $query !== '' ? $query : DEMO_FALLBACK_Q,
    'id' => $shortcutId !== '' ? $shortcutId : DEMO_FALLBACK_ID,
    'page' => $page
);

// Route A: Direct ?url=ENCODED_LINK override
if ($itemUrl !== '') {
    $target = normalizeUrl($itemUrl);
    $res = curlRequest($target);
    if (!$res['ok'] && $res['body'] === '') {
        jsonOut(array('status' => false, 'mode' => 'detail', 'error' => 'Failed to fetch URL (HTTP ' . $res['status'] . ')'), 502);
    }
    $isJson = stripos($res['content_type'], 'json') !== false || strpos(ltrim($res['body']), '{') === 0 || strpos(ltrim($res['body']), '[') === 0;
    jsonOut(parseDetailPage($res['body'], $res['final_url'], $isJson));
}

// Route B: Multi-Route ?action=detail OR Shortcut ?id=
if ($action === 'detail' || $shortcutId !== '') {
    $tpl = ROUTE_DETAIL_TEMPLATE !== '' ? ROUTE_DETAIL_TEMPLATE : STATIC_URL_TEMPLATE;
    if (strpos($tpl, '{id}') !== false || strpos($tpl, '{slug}') !== false) {
        $target = buildTemplatedUrl($tpl, $vars);
    } else {
        $sep = strpos($tpl, '?') !== false ? '&' : '?';
        $target = buildTemplatedUrl($tpl, $vars) . $sep . 'id=' . urlencode($vars['id']);
    }
    $res = curlRequest($target);
    if (!$res['ok'] && $res['body'] === '') {
        jsonOut(array('status' => false, 'mode' => 'detail', 'error' => 'Detail fetch failed (HTTP ' . $res['status'] . ')'), 502);
    }
    $isJson = stripos($res['content_type'], 'json') !== false || strpos(ltrim($res['body']), '{') === 0 || strpos(ltrim($res['body']), '[') === 0;
    jsonOut(parseDetailPage($res['body'], $res['final_url'], $isJson));
}

// Route C: Multi-Route ?action=latest
if ($action === 'latest') {
    $listUrl = buildTemplatedUrl(ROUTE_LATEST_TEMPLATE, $vars);
    $res = curlRequest($listUrl);
    if (!$res['ok'] && $res['body'] === '') {
        jsonOut(array('status' => false, 'mode' => 'list', 'error' => 'Failed to fetch latest (HTTP ' . $res['status'] . ')'), 502);
    }
    $isJson = stripos($res['content_type'], 'json') !== false || strpos(ltrim($res['body']), '{') === 0 || strpos(ltrim($res['body']), '[') === 0;
    $parsed = parseListPage($res['body'], $res['final_url'], $page, $isJson);
    $out = array(
        'status' => true,
        'mode' => 'list',
        'action' => 'latest',
        'page' => $page,
        'has_next' => $parsed['has_next'],
        'results' => $parsed['results']
    );
    if ($parsed['raw'] !== null) $out['raw'] = $parsed['raw'];
    jsonOut($out);
}

// Route D: Search (?action=search OR ?q=) OR Demo Fallback Mode (no parameters passed)
$tpl = ($action === 'search') ? ROUTE_SEARCH_TEMPLATE : STATIC_URL_TEMPLATE;
if (CAPTURED_XHR_METHOD === 'POST' && CAPTURED_POST_BODY !== '') {
    $targetPostUrl = buildTemplatedUrl($tpl, $vars);
    $payload = buildTemplatedPostBody(CAPTURED_POST_BODY, $vars);
    $res = curlRequest($targetPostUrl, 'POST', $payload, array('Content-Type: application/json'));
    $isJson = true;
} else {
    if (strpos($tpl, '{q}') !== false || strpos($tpl, '{id}') !== false || strpos($tpl, '{slug}') !== false) {
        $searchUrl = buildTemplatedUrl($tpl, $vars);
    } else {
        $sep = strpos($tpl, '?') !== false ? '&' : '?';
        $searchUrl = buildTemplatedUrl($tpl, $vars) . $sep . urlencode(TARGET_QUERY_PARAM) . '=' . urlencode($vars['q']) . ($page > 1 ? '&page=' . urlencode((string)$page) : '');
    }
    $res = curlRequest($searchUrl);
    $isJson = stripos($res['content_type'], 'json') !== false || strpos(ltrim($res['body']), '{') === 0 || strpos(ltrim($res['body']), '[') === 0;
}

if (!$res['ok'] && $res['body'] === '') {
    jsonOut(array('status' => false, 'mode' => 'list', 'error' => 'Upstream request failed (HTTP ' . $res['status'] . ')'), 502);
}

$parsed = parseListPage($res['body'], $res['final_url'], $page, $isJson);
$responseOut = array(
    'status' => true,
    'mode' => 'list',
    'demo_fallback' => $isDemoFallback,
    'page' => $page,
    'has_next' => $parsed['has_next'],
    'results' => $parsed['results']
);
if ($parsed['raw'] !== null) {
    $responseOut['raw'] = $parsed['raw'];
}
jsonOut($responseOut);
`;

  const domainBase = 'https://MY-DOMAIN.com/api.php';
  const callingUrls = {
    latest: `${domainBase}?action=latest&page=1`,
    search: `${domainBase}?action=search&q=${encodeURIComponent(demoFallbackQ)}&page=1`,
    shortcutId: `${domainBase}?action=detail&id=${encodeURIComponent(demoFallbackId)}`,
    detail: `${domainBase}?url=${encodeURIComponent(sampleItemUrl)}`,
    proxy: `${domainBase}?proxy=${encodeURIComponent(`${origin}/stream.mp4`)}`,
  };

  const jsSnippet = `async function callPhpApi(endpointUrl) {
  const res = await fetch(endpointUrl);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error('Server returned HTML instead of JSON (HTTP ' + res.status + ')');
  }
  const data = JSON.parse(text);
  if (!data.status) throw new Error(data.error || 'API Error');
  return data;
}

// Demo Fallback (no params) or Multi-Route Search / Detail
const list = await callPhpApi("${callingUrls.search}");
console.log(list.results, list.raw);

const detail = await callPhpApi("${callingUrls.shortcutId}");
console.log(detail.streams, detail.downloads, detail.raw);`;

  return { phpCode, callingUrls, jsSnippet };
}
