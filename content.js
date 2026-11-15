const extApi = globalThis.browser ?? globalThis.chrome;
var PAGES_TO_FETCH = 8;
var PRIORITY_1337X_UPLOADER = 'Wrath';

function is1337xHost(hostname = window.location.hostname) {
  return hostname.toLowerCase().includes('1337x');
}

// Alphanumeric boundaries used instead of \b to support '+' (HDR10+, DD+), '_', and glued channel layouts (TrueHD7.1, FLAC2.0)
function makeRuleRegex(patternStr, flags = 'gi') {
  return new RegExp(
    `(?<![a-zA-Z0-9])(${patternStr})(?:(?![a-zA-Z0-9])|(?=[12]\\.0(?![a-zA-Z0-9])|[567]\\.1(?![a-zA-Z0-9])))`,
    flags
  );
}

// Match homonymous release groups strictly in group/uploader positions (-Group, [Group], or standalone uploader)
function makeGroupRegex(patternStr, flags = 'gi') {
  return new RegExp(
    `(?:(?<=^)(${patternStr})(?=$)|(?<=\\[)(${patternStr})(?=\\])|(?<=[\\s._].*-)(${patternStr})(?=$|\\.(?:mkv|mp4|avi|ts|m2ts)(?![a-zA-Z0-9])|[\\]\\)]|\\s*(?:\\[|\\((?!19\\d{2}|20[0-3]\\d)))|(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|480[pP]|[xX]26[45]|[hH]\\.?26[45]|HEVC|AVC|AV1|VP9|XviD|REMUX|Blu-?[Rr]ay|BDRip|BRRip|WEB-?DL|WEBRip|HDTV|DVDRip|Atmos|TrueHD|DTS|DDP|AAC|AC3|FLAC|Opus|[12]\\.0|[567]\\.1)\\s*-\\s*)(${patternStr})(?=$|\\.(?:mkv|mp4|avi|ts|m2ts)(?![a-zA-Z0-9])|[\\]\\)]|\\s*(?:\\[|\\((?!19\\d{2}|20[0-3]\\d))))`,
    flags
  );
}

// Shared context-aware rules used by both STATIC_RULES and custom keyword lists to prevent false positives on short/homonym tags
var CONTEXTUAL_TAG_REGEXES = {
  CAM: /(?<!(?:[Bb]ody|[Dd]ash|[Ss]py|[Ww]eb|[Ll]ive|[Hh]elmet|[Cc]op|[Pp]olice|[Ss]ecurity|[Hh]idden|[Nn]anny|[Pp]et|[Tt]rail)[\s._-])(?<=(?:19\d{2}|20[0-3]\d|2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]|240[pP]|NEW|New|CLEAN|Clean|HQ|HD|PROPER|V[23]|\[|\()[\s._\])(-]{0,3})(?:CAM|Cam)(?![a-zA-Z0-9])|(?<!^)(?<!(?:[Bb]ody|[Dd]ash|[Ss]py|[Ww]eb|[Ll]ive|[Hh]elmet|[Cc]op|[Pp]olice|[Ss]ecurity|[Hh]idden|[Nn]anny|[Pp]et|[Tt]rail|BODY|DASH|SPY|WEB|LIVE|HELMET|COP|POLICE|SECURITY|HIDDEN|NANNY|PET|TRAIL)[\s._-])(?<![a-zA-Z0-9])(CAM)(?=[\s._-]+(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]|240[pP]|[xX]26[45]|H[.\s_-]?26[45]|HEVC|XviD|XVID|DivX|DIVX|AAC|MP3|AC3|LINE|MIC|MD|LD|V[23]|1XBET|MELBET|CLEAN|NEW))|(?<=[\[\(])(CAM)(?=[\]\)])/g,
  TS: /(?<!^)(?<!(?:VIDEO|AUDIO|HDTV|PDTV|SDTV|DVB|MPEG|REMUX|AVCHD|BDMV)[.\s_-])(?<=(?:19\d{2}|20[0-3]\d|2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]|240[pP]|NEW|CLEAN|HQ|HD|PROPER|V[23]|\[|\()[\s._\])(-]{0,3})(TS)(?![a-zA-Z0-9])|(?<!^)(?<!(?:VIDEO|AUDIO|HDTV|PDTV|SDTV|DVB|MPEG|REMUX|AVCHD|BDMV)[.\s_-])(?<![a-zA-Z0-9.])(TS)(?=[\s._-]+(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]|240[pP]|[xX]26[45]|H[.\s_-]?26[45]|HEVC|XviD|XVID|DivX|DIVX|AAC|MP3|AC3|LINE|MIC|MD|LD|V[23]|1XBET|MELBET|CLEAN|NEW)|[\]\)])/g,
  TC: /(?<!^)(?<=(?:19\d{2}|20[0-3]\d|2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]|240[pP]|NEW|CLEAN|HQ|HD|PROPER|V[23]|\[|\()[\s._\])(-]{0,3})(TC)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(TC)(?=[\s._-]+(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|360[pP]|240[pP]|[xX]26[45]|H[.\s_-]?26[45]|HEVC|XviD|XVID|DivX|DIVX|AAC|MP3|AC3|LINE|MIC|MD|LD|V[23]|1XBET)|[\]\)])/g,
  HC: /(?<!^)(?<=(?:19\d{2}|20[0-3]\d|2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|HDRip|HDRIP|WEBRip|WEBRIP|WEB-?DL|KORSUB|CHNSUB|\[|\()[\s._\])(-]{0,3})(HC)(?![\s._-]+Andersen)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(HC)(?![\s._-]+Andersen)(?=[\s._-]+(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|576[pP]|480[pP]|HDRip|HDRIP|WEBRip|WEBRIP|WEB-?DL|KORSUB|CHNSUB|SUBS?|Sub|[xX]26[45]|H[.\s_-]?26[45]|HEVC|XviD|XVID|AAC|MP3|AC3)|[\]\)])/g,
  MD: /(?<!^)(?<!(?:[Hh]ouse|[Hh]owser|[Dd]oogie|[Dd]r|[Mm]aryland)[\s._-])(?<=(?:GERMAN|German|FRENCH|French|TRUEFRENCH|VFF|VFQ|ITALIAN|SPANISH|DL|2160[pP]|1080[pP]|720[pP]|480[pP]|TS|HD-?TS|TC|HD-?TC|CAM|HDCAM|BDRip|BRRip|DVDRip|WEBRip|HDRip|WEB-?DL|\[|\()[\s._\])(-]{0,3})(MD)(?![a-zA-Z0-9])|(?<!^)(?<!(?:[Hh]ouse|[Hh]owser|[Dd]oogie|[Dd]r|[Mm]aryland)[\s._-])(?<![a-zA-Z0-9])(MD)(?=[\s._-]+(?:TS|HD-?TS|TC|HD-?TC|CAM|HDCAM|BDRip|BRRip|DVDRip|WEBRip|HDRip|XviD|XVID|[xX]26[45]|H[.\s_-]?26[45]|AC3|MP3|AAC)|[\]\)])/g,
  LD: /(?<!^)(?<=(?:GERMAN|German|FRENCH|French|TRUEFRENCH|VFF|VFQ|ITALIAN|SPANISH|DL|2160[pP]|1080[pP]|720[pP]|480[pP]|TS|HD-?TS|TC|HD-?TC|CAM|HDCAM|BDRip|BRRip|DVDRip|WEBRip|HDRip|WEB-?DL|\[|\()[\s._\])(-]{0,3})(LD)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(LD)(?=[\s._-]+(?:TS|HD-?TS|TC|HD-?TC|CAM|HDCAM|BDRip|BRRip|DVDRip|WEBRip|HDRip|XviD|XVID|[xX]26[45]|H[.\s_-]?26[45]|AC3|MP3|AAC)|[\]\)])/g,
  WP: /(?<!^)(?<=(?:19\d{2}|20[0-3]\d|2160[pP]|1080[pP]|720[pP]|480[pP]|\[|\()[\s._\])(-]{0,3})(WP)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(WP)(?=[\s._-]+(?:1080[pP]|720[pP]|480[pP]|[xX]26[45]|XviD|XVID|AAC|MP3|AC3)|[\]\)])/g,
  R5: /(?<!^)(?<=(?:19\d{2}|20[0-3]\d|720[pP]|480[pP]|\[|\()[\s._\])(-]{0,3})(R5)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(R5)(?=[\s._-]+(?:LINE|XviD|XVID|DivX|DIVX|DVDRip|DVDRIP|[xX]26[45]|AC3|MP3|AAC|720[pP]|480[pP])|[\]\)])/g,
  R6: /(?<!^)(?<=(?:19\d{2}|20[0-3]\d|720[pP]|480[pP]|\[|\()[\s._\])(-]{0,3})(R6)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(R6)(?=[\s._-]+(?:LINE|XviD|XVID|DivX|DIVX|DVDRip|DVDRIP|[xX]26[45]|AC3|MP3|AAC|720[pP]|480[pP])|[\]\)])/g,
  SD: /(?<!^)(?<=(?:19\d{2}|20[0-3]\d|WEB-?DL|WEBRip|WEBRIP|DVDRip|DVDRIP|HDTV|PDTV|TVRip|\[|\()[\s._\])(-]{0,3})(SD)(?![a-zA-Z0-9])|(?<!^)(?<!-)(?<![a-zA-Z0-9])(SD)(?=[\s._-]+(?:WEB-?DL|WEBRip|WEBRIP|DVDRip|DVDRIP|HDTV|[xX]26[45]|XviD|XVID|DivX|DIVX|AAC|MP3)|[\]\)])/g,
  SCREENER: /(?<!^)(?<![a-zA-Z0-9])(SCREENER)(?![a-zA-Z0-9])/gi,
  TOPAZ: /(?<![a-zA-Z0-9])(TOPAZ[\s._-]?VIDEO[\s._-]?(?:AI|ENHANCE(?:D)?))(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(TOPAZ)(?![\s._-]*\(?1969\)?)(?![a-zA-Z0-9])/gi,
  LINE: /(?<!^)(?<=(?:CAM|HDCAM|TS|HD-?TS|TC|HD-?TC|R5|R6|1080[pP]|720[pP]|480[pP]|NEW|CLEAN|HQ|V[23]|\[|\()[\s._\])(-]{0,3})(LINE)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(LINE)(?=[\s._-]+(?:AUDIO|DUBBED|MIC|[xX]26[45]|XviD|XVID|AAC|MP3|AC3|1XBET)|[\]\)])/g,
  AVI: /(?<!^)(?:(?<=\.)(?:avi|AVI)(?=$|[\s\]\)])|(?<![a-zA-Z0-9])(AVI)(?![a-zA-Z0-9]))/g,
  WATERMARK: /(?<!^)(?<![a-zA-Z0-9])(WATERMARK(?:ED)?)(?![a-zA-Z0-9])/gi,
  PINUP: /(?<!^)(?<![a-zA-Z0-9])(PINUP)(?![a-zA-Z0-9])/gi,
  CASINO: /(?<!^)(?<![a-zA-Z0-9])(CASINO)(?![\s._-]*(?:ROYALE|19\d{2}|20[0-3]\d))(?![a-zA-Z0-9])/g,
  SLOT: /(?<!^)(?<![a-zA-Z0-9])(SLOT)(?![\s._-]*(?:19\d{2}|20[0-3]\d))(?![a-zA-Z0-9])/g,
  MA: /(?<!^)(?<!DTS[\s._-]?HD[\s._-])(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|WEB-?DL|WEBDL|WEBRip|WEBRIP|WEBMux)[\s._-])(MA)(?![a-zA-Z0-9])|(?<!^)(?<!DTS[\s._-]?HD[\s._-])(?<![a-zA-Z0-9])(MA)(?=[\s._-]+WEB(?:[\s._-]?(?:DL|RIP|MUX))?(?![a-zA-Z0-9]))/g,
  MAX: /(?<!^)(?<!MAD[\s._-])(?<!PEPSI[\s._-])(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP])[\s._-])(MAX)(?=[\s._-]+WEB(?![a-zA-Z0-9]))|(?<!^)(?<!MAD[\s._-])(?<!PEPSI[\s._-])(?<=(?:WEB-?DL|WEBDL|WEBRip|WEBRIP|WEBMux)[\s._-])(MAX)(?![a-zA-Z0-9])|(?<!^)(?<!MAD[\s._-])(?<!PEPSI[\s._-])(?<![a-zA-Z0-9])(MAX)(?=[\s._-]+WEB(?:[\s._-]?(?:DL|RIP|MUX))?(?![a-zA-Z0-9]))/g,
  CR: /(?<!^)(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|WEB-?DL|WEBDL)[\s._-])(CR)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(CR)(?=[\s._-]+(?:WEB(?:[\s._-]?(?:DL|RIP|MUX))?|2160[pP]|1440[pP]|1080[pP]|720[pP]|AAC|E-?AC-?3|DDP|H[.\s_-]?26[45]|[xX]26[45]|HEVC|AV1)(?![a-zA-Z0-9]))/g,
  NF: /(?<!^)(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|WEB-?DL|WEBDL|WEBRip|WEBRIP)[\s._-])(NF)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(NF)(?=[\s._-]+(?:WEB(?:[\s._-]?(?:DL|RIP|MUX))?|2160[pP]|1440[pP]|1080[pP]|720[pP])(?![a-zA-Z0-9]))/g,
  E: /(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|[12]\.0|[567]\.1|[xX]26[45]|[hH]\.?26[45]|HEVC|hevc|AVC|avc|AV1|av1|VP9|REMUX|Remux|remux|Blu-?[Rr]ay|BLURAY|WEB-?DL|WEBRip|Atmos|ATMOS|TrueHD|TRUEHD|DTS|MA|DDP|DDPA|EAC3|AAC|AC3|FLAC|Opus|OPUS|10bit|12bit)\s*-)(E)(?=$|\.(?:mkv|mp4|avi|ts|m2ts)$|[\]\)\s]*$)/g,
  DON: /(?:(?<=^)(DON)(?=$)|(?<=\[)(DON)(?=\])|(?<=[\s._].*-)(DON)(?=$|\.(?:mkv|mp4|avi|ts|m2ts)(?![a-zA-Z0-9])|[\]\)]|\s*(?:\[|\((?!19\d{2}|20[0-3]\d))))/g,
  PRO: /(?:(?<=\[)(PRO)(?=\])|(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|[xX]26[45]|[hH]\.?26[45]|HEVC|AVC|AV1|REMUX|Blu-?[Rr]ay|WEB-?DL|WEBRip|HDTV|DVDRip|Atmos|TrueHD|DTS|DDP|AAC|AC3|FLAC)\s*-)(PRO)(?=$|\.(?:mkv|mp4|avi|ts|m2ts)(?![a-zA-Z0-9])|[\]\)]))/g,
  EPSILON: /(?:(?<![a-zA-Z0-9])(EPSiLON)(?![a-zA-Z0-9])|(?<=^)(EPSILON)(?=$)|(?<=\[)(EPSILON)(?=\])|(?<=[\s._].*-)(EPSILON)(?=$|\.(?:mkv|mp4|avi|ts|m2ts)(?![a-zA-Z0-9])|[\]\)]|\s*(?:\[|\((?!19\d{2}|20[0-3]\d))))/g,
  TERMINAL: /(?:(?<![a-zA-Z0-9])(TERMiNAL)(?![a-zA-Z0-9])|(?<=^)(TERMINAL)(?=$)|(?<=\[)(TERMINAL)(?=\])|(?<=[\s._].*-)(TERMINAL)(?=$|\.(?:mkv|mp4|avi|ts|m2ts)(?![a-zA-Z0-9])|[\]\)]|\s*(?:\[|\((?!19\d{2}|20[0-3]\d)))|(?<=(?:2160[pP]|1080[pP]|720[pP]|HEVC|[xX]26[45]|H[.\s_-]?26[45]|Atmos|ATMOS|TrueHD|TRUEHD|DTS|DDP|AAC|AC3|[57]\.1)[\s._-]+)(TERMINAL)(?![a-zA-Z0-9]))/g
};

// 5-tier thermal rules: compound patterns always precede shorter prefixes within each alternation
var STATIC_RULES = [
  // Tier 1: Lossless, 4K/8K, Dynamic HDR, Lossless/Spatial Audio, Boutique Labels, Flagship Teams
  {
    category: 'tier-1',
    regex: makeRuleRegex([
      '4320P|8K|2160P|4K|UHD[\\s._-]?REMUX|UHD[\\s._-]?BLU[\\s._-]?RAY|UHD[\\s._-]?BD|COMPLETE[\\s._-]?UHD|FULL[\\s._-]?UHD|UHD',
      'BD[\\s._-]?REMUX|DVD[\\s._-]?REMUX|REMUX|COMPLETE[\\s._-]?BLU[\\s._-]?RAY|FULL[\\s._-]?BLU[\\s._-]?RAY|UNTOUCHED|BDMV|BDISO|BD100|BD66|BD50|BD25',
      'IMAX[\\s._-]?ENHANCED|IMAX[\\s._-]?DTS|IMAX|DOLBY[\\s._-]?CINEMA|OPEN[\\s._-]?MATTE|HYBRID',
      'CRITERION[\\s._-]?COLLECTION|CRITERION|ARROW[\\s._-]?VIDEO|MASTERS[\\s._-]?OF[\\s._-]?CINEMA|POWERHOUSE[\\s._-]?INDICATOR|BFI|KINO[\\s._-]?LORBER|KLSC|SECOND[\\s._-]?SIGHT|STUDIOCANAL|SHOUT[\\s._-]?FACTORY|SCREAM[\\s._-]?FACTORY|VINEGAR[\\s._-]?SYNDROME|SEVERIN[\\s._-]?FILMS|CARLOTTA[\\s._-]?FILMS|BLUE[\\s._-]?UNDERGROUND|LE[\\s._-]?CHAT[\\s._-]?QUI[\\s._-]?FUME|POTEMKINE|88[\\s._-]?FILMS|RADIANCE[\\s._-]?FILMS|JANUS[\\s._-]?FILMS|WARNER[\\s._-]?ARCHIVE|PARAMOUNT[\\s._-]?PRESENTS|DEAF[\\s._-]?CROCODILE|MONDO[\\s._-]?MACABRO|SYNAPSE[\\s._-]?FILMS|UMBRELLA[\\s._-]?ENTERTAINMENT',
      'DOLBY[\\s._-]?VISION|DOVI[\\s._-]?P(?:10|[578](?:\\.[01246])?)|DV[\\s._-]?P(?:10|[578](?:\\.[01246])?)|CMV4\\.0|CMV2\\.9|P7[\\s._-]?FEL|P7[\\s._-]?MEL|P8\\.[14]|BL\\+EL\\+RPU|BL\\+RPU|DOVI|DV|HDR10\\+|HDR10PLUS|HDR10P|12[\\s._-]?BITS?',
      'DOLBY[\\s._-]?TRUEHD|TRUEHD|DOLBY[\\s._-]?ATMOS|ATMOS|DTS[\\s._-]?HD[\\s._-]?MASTER[\\s._-]?AUDIO|DTS[\\s._-]?HD[\\s._-]?MASTER|DTS[\\s._-]?HD[\\s._-]?MA|DTS:X|DTS[\\s._-]?X|AURO[\\s._-]?3D|LPCM|PCM|FLAC|ALAC|WAVPACK|WAV|DSD|24[\\s._-]?BITS?',
      'FRAMESTOR|KRALIMARKO|BLURANIUM|CINEMANIA|PLAYBD|PLAYHD|CTRLHD|EBP|ESIR|D-Z0N3|TAYTO|BEN[\\s._-]?THE[\\s._-]?MEN|SURFINBIRD|LEGI0N|MAINFRAME|HDMANIACS',
      'NCMT|VIETHD|SA89|C0KE|RIGHTSIZE|CHOTAB|CRISC|PTER|SADPANDA|W4NK3R|HQMUX|SICFOI|SPHD|M[\\s._-]?TEAM|CHDBITS|HDSKY|BEITAI|OURBITS|AUDIENCES',
      'BEATRICE[\\s._-]?RAWS|VODES|KAWAIIKA[\\s._-]?RAWS|KAWAIKA[\\s._-]?RAWS|MOOZZI2|MTBB|VCB[\\s._-]?STUDIO|ANK[\\s._-]?RAWS|LOWPOWER[\\s._-]?RAWS|SNOW[\\s._-]?RAWS|SOFCJ[\\s._-]?RAWS|SOFCJ|COALGIRLS|THORA|KAMETSU|OKAY[\\s._-]?SUBS|AERGIA|YURASUKA|IKIGAI'
    ].join('|'))
  },
  // FEL/MEL guarded by uppercase HDR/4K context to avoid matching "Mel Gibson" or "Mel Brooks"
  {
    category: 'tier-1',
    regex: /(?<=(?:2160[pP]|UHD|REMUX|DV|DoVi|HDR10\+?|HDR|P7|BL|HEVC)[.\s_+(-])(FEL|MEL)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(FEL|MEL)(?=[.\s_+-]+(?:DV|DoVi|HDR|2160[pP]|UHD|REMUX|HEVC|RPU)(?![a-zA-Z0-9]))/g
  },
  // Boutique labels guarded by release context to avoid matching "Arrow", "Eureka", or "Radiance" titles
  {
    category: 'tier-1',
    regex: /(?<=(?:2160[pP]|1080[pP]|UHD|REMUX|BLURAY|BLU-RAY|EDITION|RESTORED|REMASTERED|MOC)[.\s_-])(ARROW|EUREKA|MOC|INDICATOR|IMPRINT|SEVERIN|CARLOTTA|RADIANCE|CURZON|WAC)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(ARROW|EUREKA|MOC|INDICATOR|IMPRINT|SEVERIN|CARLOTTA|RADIANCE|CURZON|WAC)(?=[.\s_-]+(?:2160[pP]|1080[pP]|UHD|REMUX|BLURAY|BLU-RAY|EDITION|RESTORED|REMASTERED|VIDEO|FILMS|MOC)(?![a-zA-Z0-9]))/gi
  },
  { category: 'tier-1', regex: CONTEXTUAL_TAG_REGEXES.DON },
  { category: 'tier-1', regex: CONTEXTUAL_TAG_REGEXES.EPSILON },
  { category: 'tier-1', regex: CONTEXTUAL_TAG_REGEXES.E },
  {
    category: 'tier-1',
    regex: makeGroupRegex('LORD|HONE|SIGMA|TRITON|WIKI|CHD|BEAST|WILDCAT|MONOLITH|DECIBEL|CINEPHILES|FIDELIO|HIFI|NYX|IFT|BTM|BMF|TDD|HDT|BHD|HDB|ZQ|SCY|GJM|REINFORCE|KALEIDO|HANDJOB')
  },

  // Tier 2: Very Good (1080p/1440p, Blu-Ray/WEB-DL, Static HDR, HEVC/AV1/VVC/10-bit, DDP/Opus, Global Streaming, Top Encode/WEB Teams)
  {
    category: 'tier-2',
    regex: makeRuleRegex([
      '1440P|1080P|BLU[\\s._-]?RAY|WEB[\\s._-]?DL|WEB[\\s._-]?MUX|APPLE[\\s._-]?PRORES|PRORES|REAL[\\s._-]?PROPER|PROPER[23]?|REPACK[23]?|RERIP|DIRFIX|CUSTOM',
      'DIRECTOR\'?S[\\s._-]?CUT|EXTENDED[\\s._-]?(?:CUT|EDITION)|EXTENDED|ULTIMATE[\\s._-]?CUT|FINAL[\\s._-]?CUT|THEATRICAL[\\s._-]?CUT|THEATRICAL|UNRATED|UNCENSORED|UNCUT|INT[EÉ]GRALE|VERSION[\\s._-]?LONGUE|VERSION[\\s._-]?NON[\\s._-]?CENSUR[EÉ]E|4K[\\s._-]?(?:REMASTERED|RESTORATION)|RESTORED|REMASTERED|SPECIAL[\\s._-]?EDITION|ULTIMATE[\\s._-]?EDITION|COLLECTOR\'?S[\\s._-]?EDITION|ANNIVERSARY[\\s._-]?EDITION|DEFINITIVE[\\s._-]?EDITION',
      'HDR10|HDR|HLG|PQ10|HEVC|X265|H[.\\s_-]?265|AV1|VP9|VVC|X266|H[.\\s_-]?266|HI10P|HI10|10[\\s._-]?BITS?|YUV444P10|4:4:4|120FPS|60FPS|50FPS|HFR',
      'DTS[\\s._-]?HD[\\s._-]?HRA|DTS[\\s._-]?HD[\\s._-]?HR|DTS[\\s._-]?HD|DTS[\\s._-]?ES|DTS|OPUS|DOLBY[\\s._-]?DIGITAL[\\s._-]?PLUS',
      'DDP[\\s._-]?[57][.\\s_-]1[\\s._-]?ATMOS|DD\\+[\\s._-]?[57][.\\s_-]1[\\s._-]?ATMOS|E[\\s._-]?AC[\\s._-]?3[\\s._-]?[57][.\\s_-]1[\\s._-]?ATMOS',
      'DDP[\\s._-]?ATMOS|DD\\+[\\s._-]?ATMOS|E[\\s._-]?AC[\\s._-]?3[\\s._-]?ATMOS|DDPA[\\s._-]?[57][.\\s_-]1|DDPA',
      'DDP[\\s._-]?[57][.\\s_-]1[\\s._-]?JOC|E[\\s._-]?AC[\\s._-]?3[\\s._-]?[57][.\\s_-]1[\\s._-]?JOC',
      'DDP[\\s._-]?7[.\\s_-]1|DDP[\\s._-]?5[.\\s_-]1|DDP[\\s._-]?2[.\\s_-]0|DDP[\\s._-]?1[.\\s_-]0|DDP',
      'DD\\+[\\s._-]?7[.\\s_-]1|DD\\+[\\s._-]?5[.\\s_-]1|DD\\+[\\s._-]?2[.\\s_-]0|DD\\+[\\s._-]?1[.\\s_-]0|DD\\+',
      'E[\\s._-]?AC[\\s._-]?3[\\s._-]?7[.\\s_-]1|E[\\s._-]?AC[\\s._-]?3[\\s._-]?5[.\\s_-]1|E[\\s._-]?AC[\\s._-]?3[\\s._-]?2[.\\s_-]0|E[\\s._-]?AC[\\s._-]?3[\\s._-]?1[.\\s_-]0|E[\\s._-]?AC[\\s._-]?3',
      'SONY[\\s._-]?PICTURES[\\s._-]?CORE|BCORE|ATVP|APPLE[\\s._-]?TV\\+?|ITUNES|DSNP|DISNEY[\\s._-]?PLUS|DISNEY\\+|AMZN|PRIME[\\s._-]?VIDEO|NETFLIX|HBO[\\s._-]?MAX|HMAX|MOVIES[\\s._-]?ANYWHERE|PCOK|PMTP|PARAMOUNT[\\s._-]?PLUS|PARAMOUNT\\+|HULU|MUBI|SHUDDER|SHDR|SKYSHOWTIME|SKST|STARZ|STRZ|JIOHOTSTAR|HOTSTAR|VUDU|CRUNCHYROLL|HIDIVE|ADN|MYCANAL|CANAL\\+',
      'NTB|NTG|CMRG|TEPES|PLAYWEB|HHWEB|KONTRAST|THEFARM|BHDSTUDIO|QXR|TIGOLE|TAOE|UTR|VYNDROS|CASSTUDIO|MZABI|DARQ|TOMBDOC|SUCCESSFULCRAB|PECULATE|NHTFS|NOSIVID|CMCT|FRDS',
      'DAV1NCI|RAV1NE|EDGE2020|RCVR|AJP69|BYNDR|EDPH',
      'SUBSPLEASE|ERAI[\\s._-]?RAWS|VARYG|TOONSHUB|TSUNDERE[\\s._-]?RAWS|YAMEII|NEKO[\\s._-]?RAWS|LOLIHOUSE|HORRIBLESUBS|GOLUMPA|CHYUU'
    ].join('|'))
  },
  { category: 'tier-2', regex: CONTEXTUAL_TAG_REGEXES.MA },
  { category: 'tier-2', regex: CONTEXTUAL_TAG_REGEXES.MAX },
  { category: 'tier-2', regex: CONTEXTUAL_TAG_REGEXES.CR },
  { category: 'tier-2', regex: CONTEXTUAL_TAG_REGEXES.NF },
  { category: 'tier-2', regex: CONTEXTUAL_TAG_REGEXES.TERMINAL },
  {
    category: 'tier-2',
    regex: /(?<=[\[\(])(BD)(?=[\]\)])|(?<=(?:2160[pP]|1440[pP]|1080[pP])[\s._-])(BD)(?=[\s._-]+(?:REMUX|HEVC|[xX]26[45]|H[.\s_-]?26[45]|AV1|FLAC|AAC|OPUS|10[Bb]it|Hi10P)(?![a-zA-Z0-9]))/g
  },
  {
    category: 'tier-2',
    regex: /(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP])[\s._-])(iT)(?=[\s._-]+WEB(?:[\s._-]?(?:DL|RIP|MUX))?(?![a-zA-Z0-9]))/g
  },
  {
    category: 'tier-2',
    regex: /(?<!^)(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|WEB-?DL|WEBDL|WEBRip|WEBRIP)[\s._-])(PEACOCK|ARTE|FAH)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(PEACOCK|ARTE|FAH)(?=[\s._-]+(?:WEB(?:[\s._-]?(?:DL|RIP|MUX))?|2160[pP]|1440[pP]|1080[pP]|720[pP]|HDTV)(?![a-zA-Z0-9]))/gi
  },
  {
    category: 'tier-2',
    regex: /(?<!^)(?<=(?:DDP|DD\+|E-?AC-?3|Atmos|ATMOS|5\.1|7\.1)[\s._-])(JOC)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(JOC)(?=[\s._-]+(?:Atmos|ATMOS|H[.\s_-]?26[45]|[xX]26[45]|HEVC|AV1)(?![a-zA-Z0-9]))/g
  },
  {
    category: 'tier-2',
    regex: /(?<!^)(?<=(?:FRENCH|TRUEFRENCH|VFF|VFQ|MULTI|2160[pP]|1080[pP]|720[pP]|BluRay|BLU-RAY|WEB-?DL|REMUX)[\s._-])(VL)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(VL)(?=[\s._-]+(?:FRENCH|TRUEFRENCH|VFF|VFQ|MULTI|2160[pP]|1080[pP]|720[pP]|BluRay|BLU-RAY|WEB-?DL|REMUX)(?![a-zA-Z0-9]))/g
  },
  {
    category: 'tier-2',
    regex: makeGroupRegex('FLUX|GHOST|SILENCE|SURCODE|SMURF|HALLOWED|DEFLATE|SIC|KIRA|SARTRE|PHOBOS|MONKEE|TOMMY|KINGS|RTN|GNOME|FRATERNITY|TSUNAMI|JUDAS|EMBER|KITSUNE|CLEO|COMMIE|ASW|DKB|BANDI|SAMPA|GLHF|KOGI|WADU|ROEN')
  },

  // Tier 3: Standard (1080i, WEBRip/WEB, AVC/x264/VC-1, AC3/AAC/Channel Layouts, Regional Streaming, Languages/Subs/Packs, Scene Teams)
  {
    category: 'tier-3',
    regex: makeRuleRegex([
      '1080I|WEB[\\s._-]?RIP|X264|H[.\\s_-]?264|AVC|VC-?1|MPEG[\\s._-]?4|HI444PP|READNFO',
      'DOLBY[\\s._-]?DIGITAL|DOLBYD|DD[\\s._-]?5[.\\s_-]1|DD[\\s._-]?2[.\\s_-]0|DD[\\s._-]?1[.\\s_-]0|AC[\\s._-]?3[\\s._-]?5[.\\s_-]1|AC[\\s._-]?3[\\s._-]?2[.\\s_-]0|AC[\\s._-]?3[\\s._-]?1[.\\s_-]0|AC[\\s._-]?3|AAC[\\s._-]?LC|AAC[\\s._-]?5[.\\s_-]1|AAC[\\s._-]?2[.\\s_-]0|AAC|STEREO|MONO',
      'CRAVE|CRAV|B-GLOBAL|BGLOBAL|WAKANIM|BILIBILI|VIU|IQIYI|WETV|TVING|COUPANG|WAVVE|ABEMA|WOWOW|AT-X|BBC|IPLAYER|ITVX|ALL4|MY5|NOWTV|OCS|FTV|FRANCE[\\s._-]?TV|TF1\\+?|M6\\+?|6PLAY|ROKU|MGM\\+|AMC\\+|TUBI|FREEVEE|PLUTO[\\s._-]?TV',
      'MULTI[\\s._-]?SUBS|MULTI[\\s._-]?AUDIO|MULTI\\d+|DUAL[\\s._-]?AUDIO|TRIPLE[\\s._-]?AUDIO|TRUEFRENCH|SUBFRENCH|VFF|VFI|VFQ|VFB|VF2|VOSTFR|VOSTA|ESUBS|ESUB|MSUBS|MSUB|SOFTSUBS|SOFTSUB|SUBBED|SUBS|SDH',
      'COMPLETE[\\s._-](?:SERIES|SEASON|COLLECTION|TRILOGY|SAGA|PACK|BOXSET)|SEASON[\\s._-]?PACK',
      '3D|FULL[\\s._-]?SBS|HALF[\\s._-]?SBS|HSBS|H-SBS|FULL[\\s._-]?OU|HALF[\\s._-]?OU|H-OU',
      'SWTYBLZ|PSYCHD|GGWP|SKGTV|METCON|RARTV|NOGRP|SHORTBREHD'
    ].join('|'))
  },
  // Standalone or codec-glued channel layouts (e.g. "TrueHD 7.1" and "TrueHD7.1") without matching version strings like v1.2.0
  {
    category: 'tier-3',
    regex: /(?<![a-zA-Z0-9.])(7[.\s_-]1|6[.\s_-]1|5[.\s_-]1|2[.\s_-]0|1[.\s_-]0)(?![a-zA-Z0-9.])|(?<=(?:TRUEHD|ATMOS|MA|HRA|HR|ES|DTS|LPCM|PCM|FLAC|ALAC|OPUS|DDPA|DDP|EAC3|AC3|AAC))([567]\.1|[12]\.0)(?![a-zA-Z0-9.])/gi
  },
  {
    category: 'tier-3',
    regex: /(?<!^)(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|ATVP|AMZN|NF|DSNP|HMAX|MAX|HULU|PCOK|PMTP|MA|BCORE|CR)[\s._-])(WEB)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(WEB)(?=[\s._-]+(?:H[.\s_-]?26[45]|[xX]26[45]|HEVC|AV1|AVC|AAC|DDP|E-?AC-?3|AC-?3|DD|DTS|2160[pP]|1440[pP]|1080[pP]|720[pP])(?![a-zA-Z0-9]))/g
  },
  {
    category: 'tier-3',
    regex: /(?<!^)(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|BluRay|BLU-RAY|WEB-?DL|WEBRip|REMUX|H[.\s_-]?26[45]|[xX]26[45]|HEVC)[\s._-])(DD)(?![a-zA-Z0-9+])|(?<!^)(?<![a-zA-Z0-9])(DD)(?=[\s._-]+(?:H[.\s_-]?26[45]|[xX]26[45]|HEVC|AVC|AV1|2160[pP]|1080[pP]|720[pP])(?![a-zA-Z0-9]))/g
  },
  {
    category: 'tier-3',
    regex: /(?<!^)(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|WEB-?DL|WEBDL|WEBRip|WEBRIP)[\s._-])(STAN|SALTO|BINGE|PLEX)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(STAN|SALTO|BINGE|PLEX)(?=[\s._-]+(?:WEB(?:[\s._-]?(?:DL|RIP|MUX))?|2160[pP]|1440[pP]|1080[pP]|720[pP])(?![a-zA-Z0-9]))/gi
  },
  // Case-sensitive and context-guarded language/pack tokens to avoid title homonyms ("The French Dispatch", "The Bad Batch", "A Complete Unknown")
  {
    category: 'tier-3',
    regex: /(?<!^)(?<![a-zA-Z0-9])(INTERNAL|iNTERNAL|RETAIL|MULTi|MULTI|FRENCH|GERMAN|SPANISH|ITALIAN|RUSSIAN|JAPANESE|KOREAN|PORTUGUESE|NORDIC|DUTCH|POLISH|HINDI|ARABIC|TURKISH|CHINESE|LATINO|PT-BR|VO|VF|ENG|JAP|JPN|ITA|SPA|GER|DEU|KOR|POR|RUS|FRE|FRA|ESP|LAT|HIN|POL|NLD|ARA|TUR|CHS|CHT|HOU)(?![a-zA-Z0-9])/g
  },
  {
    category: 'tier-3',
    regex: /(?<=(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|REMUX|BDRemux|BluRay|Blu-Ray|BDRip|BRRip|WEB-?DL|WEBRip|DVDRip|HDTV|HDR10\+?|HDR|DV|DoVi|HEVC|[xX]26[45]|AV1|Eng|Ita|Fra|Fre|Ger|Spa|Esp|Por|Rus|Jpn|Jap|Kor|Hin|Pol)[\s._-]|[\[\(])(Eng|Ita|Fra|Fre|Ger|Spa|Esp|Por|Rus|Jpn|Jap|Kor|Hin|Pol)(?=[\s._-]+(?:2160[pP]|1440[pP]|1080[pP]|720[pP]|REMUX|BDRemux|BluRay|BDRip|WEB-?DL|WEBRip|HEVC|[xX]26[45]|H\.?26[45]|AV1|TrueHD|Atmos|DTS|DDP|AC3|AAC|FLAC|Opus|Sub|SUBS?|Eng|Ita|Fra|Fre|Ger|Spa|Esp|Por|Rus|Jpn|Jap|Kor|Hin|Pol)|[\]\)])/g
  },
  {
    category: 'tier-3',
    regex: /(?<=(?:19\d{2}|20[0-3]\d|2160[pP]|1080[pP]|720[pP]|BluRay|BLU-RAY|WEB-?DL|WEBRip|DVDRip|HDTV|REMUX|CUSTOM)[\s._-])(French|German|Spanish|Italian|Multi|Dual)(?![a-zA-Z0-9])|(?<!^)(?<![a-zA-Z0-9])(DUAL|COMPLETE)(?![a-zA-Z0-9])|(?<=(?:S\d{1,2}|Season[\s._-]\d{1,2}|19\d{2}|20[0-3]\d|2160[pP]|1080[pP]|720[pP]|BluRay|WEB-?DL|WEBRip)[\s._-])(Complete)(?![a-zA-Z0-9])/g
  },
  {
    category: 'tier-3',
    regex: /(?<=[\[\(])(BATCH)(?=[\s._-]*[\]\)])|(?<![Bb]ad[\s._-])(?<=(?:2160[pP]|1080[pP]|720[pP]|BD|BluRay|WEB|S\d{1,2}|Season[\s._-]\d{1,2}|19\d{2}|20[0-3]\d)[\s._-])(BATCH)(?![a-zA-Z0-9])/gi
  },
  { category: 'tier-3', regex: CONTEXTUAL_TAG_REGEXES.PRO },
  {
    category: 'tier-3',
    regex: makeGroupRegex('SPARKS|GECKOS|AMIABLE|DRONES|BLOW|CINEMA|SAPHIRE|SINNERS|VENUE|WATCHER|CAKES|DIMENSION|LOL|FLEET|KILLERS|ETHEL|EDITH|ELEANOR|GOSSIP|NOMA|CRAVERS|DEFIANCE|ROVERS|LOST|ROUGH|BAGGINS|BRINK|MELBA|HYBRIS|SYNCOPY|BOMBARDIERS|CARPEDIEM|AVS|SVA|FGT|VPPV|NAISU|DEMAND|STRIFE|BAE|DDR|NAHOM')
  },

  // Tier 4: Poor (720p, Micro-Encodes, BDRip/BRRip/DVDRip/HDTV, SDR, 8-bit, HE-AAC, Micro-Encoder Groups)
  {
    category: 'tier-4',
    regex: makeRuleRegex([
      '720P|720I|HD[\\s._-]?LIGHT|4K[\\s._-]?LIGHT|MINI[\\s._-]?HD|MICRO[\\s._-]?HD|MHD|BLU[\\s._-]?RAY[\\s._-]?RIP|BD[\\s._-]?RIP|BR[\\s._-]?RIP|HD[\\s._-]?RIP|DVD[\\s._-]?RIP|DVD9|DVD5|VIDEO_TS|DVDISO|DVDR|HDTV[\\s._-]?RIP|HDTV|DUBBED|8[\\s._-]?BITS?',
      'HE[\\s._-]?AAC[\\s._-]?5[.\\s_-]1|HE[\\s._-]?AAC[\\s._-]?2[.\\s_-]0|HE[\\s._-]?AAC|AAC[\\s._-]?HE',
      'YTS\\.MX|YTS|YIFY|PSARIPS|MEGUSTA|PAHE\\.IN|PAHE|RARBG|ETRG|ION10|ION265|GALAXYRG265|GALAXYRG|GALAXYTV|TGXGOODIES|TGX|RZEROX|EZTVX|EZTV|RMTEAM|ANOXMOUS|VXT|SHAANIG|SHANIG|GANOOL|MKVHUB|WORLDMKV|HEVCBAY|MKVCAGE|WILL1869'
    ].join('|'))
  },
  {
    category: 'tier-4',
    regex: /(?<!^)(?<![a-zA-Z0-9])(SDR)(?![a-zA-Z0-9])/g
  },
  {
    category: 'tier-4',
    regex: makeGroupRegex('EVO|JOY|LAMA|BONE|FENIX|COLLECTIVE|ELITE|MINX|GAZ|MX|PSA')
  },

  // Tier 5: Avoid (Cinema Captures, Mic Audio, <=576p, Legacy Sources, Obsolete Formats, Hardsubs/Watermarks, AI Upscales, Betting Spam)
  {
    category: 'tier-5',
    regex: makeRuleRegex([
      'CAM[\\s._-]?RIP|HD[\\s._-]?CAM|HQ[\\s._-]?CAM|NEW[\\s._-]?CAM|CLEAN[\\s._-]?CAM',
      'TELESYNC|HD[\\s._-]?TS|HQ[\\s._-]?TS|NEW[\\s._-]?TS|TS[\\s._-]?RIP|TSCAM',
      'TELECINE|HD[\\s._-]?TC|TC[\\s._-]?RIP',
      'PRE[\\s._-]?DVD[\\s._-]?RIP|PRE[\\s._-]?DVD|WORKPRINT|DVD[\\s._-]?SCR(?:EENER)?|BD[\\s._-]?SCR(?:EENER)?|WEB[\\s._-]?SCR(?:EENER)?',
      'LINE[\\s._-]?AUDIO|LINE[\\s._-]?DUBBED|CAM[\\s._-]?AUDIO|HQ[\\s._-]?MIC|MIC[\\s._-]?DUBBED',
      '576P|576I|480P|480I|360P|240P',
      'PDTV|SDTV|DSRIP|DSR|TV[\\s._-]?RIP|SAT[\\s._-]?RIP|VHS[\\s._-]?RIP|PPV[\\s._-]?RIP|VOD[\\s._-]?RIP|WEBCAP',
      'XVID|DIVX|WMV|MPEG(?![\\s._-]?4)(?:[\\s._-]?[12])?|MPG|FLV|RMVB|3GP|MP3|WMA|OGG',
      'KORSUB|CHNSUB|HARDSUBS|HARDSUB|HARDCODED',
      'AI[\\s._-]?UPSCALED|AI[\\s._-]?ENHANCED|AI[\\s._-]?UPSCALE|UPSCALED|UPSCALE',
      '1XBET|1XBIT|MELBET|MOSTBET|MEGAPARI|888STARZ|BET365|BETWINNER|LINEBET|PARIMATCH|1WIN|22BET'
    ].join('|'))
  },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.CAM },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.TS },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.TC },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.HC },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.MD },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.LD },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.WP },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.R5 },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.R6 },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.SD },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.SCREENER },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.TOPAZ },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.LINE },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.AVI },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.WATERMARK },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.PINUP },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.CASINO },
  { category: 'tier-5', regex: CONTEXTUAL_TAG_REGEXES.SLOT }
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgNode(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, val]) => el.setAttribute(key, String(val)));
  return el;
}

const ICON_SPECS = {
  weight: {
    attrs: { class: 'tor-btn-icon tor-icon-weight', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['path', { class: 'tor-weight-bar tor-weight-bar-1', d: 'M3 6h18' }],
      ['path', { class: 'tor-weight-bar tor-weight-bar-2', d: 'M6 12h12' }],
      ['path', { class: 'tor-weight-bar tor-weight-bar-3', d: 'M9.5 18h5' }]
    ]
  },
  seeds: {
    attrs: { class: 'tor-btn-icon tor-icon-seeds', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['path', { d: 'M12 19V5' }],
      ['polyline', { points: '5 12 12 5 19 12' }]
    ]
  },
  dark: {
    attrs: { class: 'tor-btn-icon tor-icon-dark', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }]
    ]
  },
  trash: {
    attrs: { class: 'tor-btn-icon tor-icon-trash', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['circle', { cx: 12, cy: 12, r: 10 }],
      ['line', { x1: 4.93, y1: 4.93, x2: 19.07, y2: 19.07 }]
    ]
  },
  star: {
    attrs: { class: 'tor-star-icon', width: 12, height: 12, viewBox: '0 0 24 24', fill: '#facc15', stroke: '#facc15', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }]
    ]
  },
  search: {
    attrs: { class: 'tor-search-icon', width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['circle', { cx: 11, cy: 11, r: 8 }],
      ['line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }]
    ]
  },
  close: {
    attrs: { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['line', { x1: 18, y1: 6, x2: 6, y2: 18 }],
      ['line', { x1: 6, y1: 6, x2: 18, y2: 18 }]
    ]
  },
  cc: {
    attrs: { width: 20, height: 20, viewBox: '0 0 24 24', preserveAspectRatio: 'xMidYMid meet', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    children: [
      ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2.5, ry: 2.5, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }],
      ['path', { d: 'M10.5 9.8a2.8 2.8 0 1 0 0 4.4' }],
      ['path', { d: 'M18 9.8a2.8 2.8 0 1 0 0 4.4' }]
    ]
  }
};

function createSvgIcon(name) {
  const spec = ICON_SPECS[name];
  const svg = createSvgNode('svg', spec.attrs);
  spec.children.forEach(([tag, attrs]) => svg.appendChild(createSvgNode(tag, attrs)));
  return svg;
}

function injectStyles() {
  if (document.getElementById('tor-deterministic-styles')) return;
  const style = document.createElement('style');
  style.id = 'tor-deterministic-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap');

    table.table-list tr,
    table.table-list td,
    table.table2 tr,
    table.table2 td,
    table.table2 .tt-name,
    table.torrent-list tr,
    table.torrent-list td,
    table.tor-enhanced tr,
    table.tor-enhanced td {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      white-space: normal !important;
      line-height: 1.55 !important;
      vertical-align: middle !important;
    }

    table.table-list td.coll-1,
    table.table-list td.name {
      position: relative !important;
      padding: 10px 12px 10px 40px !important;
    }
    table.table-list td.coll-1 a.icon,
    table.table-list td.name a.icon {
      position: absolute !important;
      left: 10px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      margin: 0 !important;
      float: none !important;
      z-index: 1 !important;
    }
    table.table-list td.coll-1 a:not(.icon):not(.tor-cc-btn),
    table.table-list td.name a:not(.icon):not(.tor-cc-btn),
    table.table2 .tt-name a:not(.csprite_dl14):not(.tor-cc-btn),
    table.tor-enhanced a.tor-title-link {
      white-space: normal !important;
      line-height: 1.55 !important;
      word-break: break-word !important;
      font-family: 'Inter', system-ui, sans-serif !important;
      font-size: 13px !important;
      font-weight: 600 !important;
    }
    table.table-list td.coll-1 a:not(.icon):not(.tor-cc-btn),
    table.table-list td.name a:not(.icon):not(.tor-cc-btn),
    table.table2 .tt-name a:not(.csprite_dl14):not(.tor-cc-btn),
    table.torrent-list td[colspan="2"] a:not(.comments):not(.tor-cc-btn),
    table.tor-enhanced a.tor-title-link {
      display: inline !important;
    }

    table.table-list:not(.tor-dark-table) tbody tr td.coll-1 a:not(.icon):not(.tor-cc-btn),
    table.table-list:not(.tor-dark-table) tbody tr td.coll-1 a:not(.icon):not(.tor-cc-btn):visited,
    table.table-list:not(.tor-dark-table) tbody tr td.coll-1 a:not(.icon):not(.tor-cc-btn):link,
    table.table-list:not(.tor-dark-table) tbody tr td.name a:not(.icon):not(.tor-cc-btn),
    table.table-list:not(.tor-dark-table) tbody tr td.name a:not(.icon):not(.tor-cc-btn):visited,
    table.table-list:not(.tor-dark-table) tbody tr td.name a:not(.icon):not(.tor-cc-btn):link,
    table.table2:not(.tor-dark-table) tbody tr .tt-name a:not(.tor-cc-btn),
    table.table2:not(.tor-dark-table) tbody tr .tt-name a:not(.tor-cc-btn):visited,
    table.table2:not(.tor-dark-table) tbody tr .tt-name a:not(.tor-cc-btn):link,
    table.torrent-list:not(.tor-dark-table) tbody tr td[colspan="2"] a:not(.comments):not(.tor-cc-btn),
    table.torrent-list:not(.tor-dark-table) tbody tr td[colspan="2"] a:not(.comments):not(.tor-cc-btn):visited,
    table.torrent-list:not(.tor-dark-table) tbody tr td[colspan="2"] a:not(.comments):not(.tor-cc-btn):link {
      color: #0f172a !important;
    }

    table.tor-dark-table {
      background: #09090b !important;
      color: #f8fafc !important;
      border-collapse: collapse !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45) !important;
    }

    table.tor-dark-table thead,
    table.tor-dark-table thead tr,
    table.tor-dark-table thead th,
    table.tor-dark-table thead td,
    table.tor-dark-table thead th *,
    table.tor-dark-table thead td *,
    table.tor-dark-table tr:first-child th,
    table.tor-dark-table tr:first-child th *,
    table.tor-dark-table.table2 tr:first-child td,
    table.tor-dark-table.table2 tr:first-child td * {
      background-color: #141418 !important;
      background-image: none !important;
      color: #f8fafc !important;
      border-color: rgba(255, 255, 255, 0.1) !important;
      font-family: 'Inter', sans-serif !important;
      font-size: 11.5px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
    }

    table.tor-dark-table tbody tr,
    table.tor-dark-table tbody tr:where(.default, .success, .danger),
    table.tor-dark-table tbody tr:nth-of-type(odd),
    table.tor-dark-table tbody tr:nth-of-type(even),
    table.tor-dark-table tr {
      background-color: #09090b !important;
      background-image: none !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
      transition: background-color 0.12s ease !important;
    }
    table.tor-dark-table tbody tr:hover,
    table.tor-dark-table tbody tr:where(.default, .success, .danger):hover,
    table.tor-dark-table tr:hover {
      background-color: rgba(255, 255, 255, 0.055) !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr {
      transition: background-color 0.12s ease !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover {
      background-color: rgba(15, 23, 42, 0.045) !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover > td {
      background-color: transparent !important;
    }

    table.tor-dark-table td,
    table.tor-dark-table tbody tr:where(.default, .success, .danger) > td,
    table.tor-dark-table tbody tr:hover > td {
      background-color: transparent !important;
      background-image: none !important;
      color: #e2e8f0 !important;
      border-color: rgba(255, 255, 255, 0.06) !important;
    }

    table.tor-dark-table tbody tr td a:not(.tor-cc-btn),
    table.tor-dark-table tbody tr td a:not(.tor-cc-btn):visited,
    table.tor-dark-table tbody tr td a:not(.tor-cc-btn):link,
    table.tor-dark-table tbody tr td a:not(.tor-cc-btn):hover,
    table.tor-dark-table tbody tr td.coll-1 a:not(.icon):not(.tor-cc-btn),
    table.tor-dark-table tbody tr td.coll-1 a:not(.icon):not(.tor-cc-btn):visited,
    table.tor-dark-table tbody tr td.name a:not(.icon):not(.tor-cc-btn),
    table.tor-dark-table tbody tr td.name a:not(.icon):not(.tor-cc-btn):visited,
    table.tor-dark-table tbody tr .tt-name a:not(.tor-cc-btn),
    table.tor-dark-table tbody tr .tt-name a:not(.tor-cc-btn):visited,
    table.tor-dark-table tbody tr a.tor-title-link,
    table.tor-dark-table tbody tr a.tor-title-link:visited {
      color: #ffffff !important;
      text-decoration: none !important;
    }

    table.torrent-list.tor-dark-table tbody tr td a.comments {
      color: #94a3b8 !important;
    }

    table.tor-dark-table tbody tr td.coll-2,
    table.tor-dark-table tbody tr:hover td.coll-2,
    table.tor-dark-table tbody tr td.seeds,
    table.tor-dark-table tbody tr:hover td.seeds,
    table.tor-dark-table tbody tr .tdseed,
    table.tor-dark-table tbody tr:hover .tdseed,
    table.tor-dark-table tbody tr td.tor-cell-seeds,
    table.tor-dark-table tbody tr:hover td.tor-cell-seeds,
    table.torrent-list.tor-dark-table tbody tr > td:nth-child(6),
    table.torrent-list.tor-dark-table tbody tr:hover > td:nth-child(6),
    table.tor-dark-table tbody tr td.coll-2 *,
    table.tor-dark-table tbody tr:hover td.coll-2 *,
    table.tor-dark-table tbody tr td.seeds *,
    table.tor-dark-table tbody tr:hover td.seeds *,
    table.tor-dark-table tbody tr .tdseed *,
    table.tor-dark-table tbody tr:hover .tdseed *,
    table.tor-dark-table tbody tr td.tor-cell-seeds *,
    table.tor-dark-table tbody tr:hover td.tor-cell-seeds * {
      color: #4ade80 !important;
      font-weight: 700 !important;
    }
    table.tor-dark-table tbody tr td.coll-3,
    table.tor-dark-table tbody tr:hover td.coll-3,
    table.tor-dark-table tbody tr td.leeches,
    table.tor-dark-table tbody tr:hover td.leeches,
    table.tor-dark-table tbody tr .tdleech,
    table.tor-dark-table tbody tr:hover .tdleech,
    table.tor-dark-table tbody tr td.tor-cell-leeches,
    table.tor-dark-table tbody tr:hover td.tor-cell-leeches,
    table.torrent-list.tor-dark-table tbody tr > td:nth-child(7),
    table.torrent-list.tor-dark-table tbody tr:hover > td:nth-child(7),
    table.tor-dark-table tbody tr td.coll-3 *,
    table.tor-dark-table tbody tr:hover td.coll-3 *,
    table.tor-dark-table tbody tr td.leeches *,
    table.tor-dark-table tbody tr:hover td.leeches *,
    table.tor-dark-table tbody tr .tdleech *,
    table.tor-dark-table tbody tr:hover .tdleech *,
    table.tor-dark-table tbody tr td.tor-cell-leeches *,
    table.tor-dark-table tbody tr:hover td.tor-cell-leeches * {
      color: #f87171 !important;
      font-weight: 600 !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.coll-2,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.seeds,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover .tdseed,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.tor-cell-seeds,
    table.torrent-list.tor-enhanced:not(.tor-dark-table) tbody tr:hover > td:nth-child(6),
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.coll-2 *,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.seeds *,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover .tdseed *,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.tor-cell-seeds * {
      color: #15803d !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.coll-3,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.leeches,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover .tdleech,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.tor-cell-leeches,
    table.torrent-list.tor-enhanced:not(.tor-dark-table) tbody tr:hover > td:nth-child(7),
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.coll-3 *,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.leeches *,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover .tdleech *,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.tor-cell-leeches * {
      color: #dc2626 !important;
    }

    table.tor-enhanced tbody tr td.tor-cell-size,
    table.tor-enhanced tbody tr td.tor-cell-size * {
      transition: color 0.12s ease, text-shadow 0.12s ease !important;
    }
    table.tor-dark-table tbody tr:hover td.tor-cell-size,
    table.tor-dark-table tbody tr:hover td.tor-cell-size * {
      color: #38bdf8 !important;
      text-shadow: 0 0 8px rgba(56, 189, 248, 0.25) !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.tor-cell-size,
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover td.tor-cell-size * {
      color: #0284c7 !important;
      text-shadow: 0 0 8px rgba(2, 132, 199, 0.2) !important;
    }

    #tor-control-bar {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #09090b;
      color: #f8fafc;
      padding: 12px 16px;
      border-radius: 12px;
      margin: 14px 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
    }
    .tor-bar-row {
      display: flex;
      align-items: center;
      gap: 9px;
      flex-wrap: wrap;
    }
    .tor-legend {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tor-sort-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #121215;
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 7px 12px;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.2;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }
    .tor-sort-btn:not(.active):hover {
      background: #1e1e26;
      border-color: rgba(255, 255, 255, 0.28);
      color: #ffffff;
      transform: translateY(-1px);
    }
    .tor-sort-btn.active {
      background: linear-gradient(135deg, #0284c7, #0ea5e9);
      color: #ffffff;
      border-color: #38bdf8;
      box-shadow: 0 0 14px rgba(14, 165, 233, 0.38);
    }
    #tor-seeds-btn {
      position: relative;
      overflow: hidden;
    }
    #tor-seeds-btn > span:not(.th-speed-line) {
      position: relative;
      z-index: 1;
    }
    #tor-seeds-btn.active {
      background: linear-gradient(135deg, #059669, #10b981);
      border-color: #34d399;
      color: #ffffff;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.38);
    }
    #tor-trash-btn.active {
      background: linear-gradient(135deg, #b91c1c, #dc2626);
      border-color: #f87171;
      color: #ffffff;
      box-shadow: 0 0 14px rgba(220, 38, 38, 0.36);
    }
    .tor-sort-btn.active:hover {
      filter: brightness(1.12);
    }
    .tor-sort-btn:active {
      transform: scale(0.94) !important;
    }

    .tor-btn-icon,
    .tor-star-icon {
      flex-shrink: 0;
      transform-origin: center;
    }
    .th-seeder-arrow-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      z-index: 1;
    }
    .th-seeder-arrow-wrap .tor-icon-seeds {
      position: relative;
      z-index: 1;
    }
    .th-speed-line {
      position: absolute;
      top: -18px;
      border-radius: 999px;
      background: linear-gradient(to bottom, rgba(74, 222, 128, 0.08), rgba(220, 252, 231, 0.88), rgba(74, 222, 128, 0.16));
      opacity: 0;
      pointer-events: none;
      z-index: 0;
      will-change: transform, opacity;
    }
    .th-speed-line-1 { left: 8%; width: 1px; height: 11px; --th-sl-op: 0.52; }
    .th-speed-line-2 { left: 23%; width: 1.5px; height: 15px; --th-sl-op: 0.8; }
    .th-speed-line-3 { left: 39%; width: 1.2px; height: 13px; --th-sl-op: 0.62; }
    .th-speed-line-4 { left: 58%; width: 1.4px; height: 16px; --th-sl-op: 0.76; }
    .th-speed-line-5 { left: 75%; width: 1.2px; height: 12px; --th-sl-op: 0.6; }
    .th-speed-line-6 { left: 91%; width: 1px; height: 10px; --th-sl-op: 0.48; }

    .tor-icon-weight {
      color: #38bdf8;
    }
    .tor-icon-weight .tor-weight-bar {
      transform-box: fill-box;
      transform-origin: center;
    }
    .tor-icon-seeds {
      color: #4ade80;
    }
    .tor-icon-dark {
      color: #fbbf24;
      transition: filter 220ms ease;
    }
    .tor-icon-trash {
      color: #f87171;
    }
    .tor-star-icon {
      transform-origin: 50% 52%;
      transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease;
    }
    .tor-sort-btn.active .tor-icon-weight {
      color: #e0f2fe;
    }
    .tor-sort-btn.active .tor-icon-seeds {
      color: #dcfce7;
    }
    .tor-sort-btn.active .tor-icon-trash {
      color: #fee2e2;
    }

    @keyframes tor-moon-tilt {
      0% { transform: rotate(0deg); filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0)); }
      44% { transform: rotate(-17deg); filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.42)); }
      66% { transform: rotate(-13deg); filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.3)); }
      88% { transform: rotate(2deg); }
      100% { transform: rotate(0deg); filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0)); }
    }
    @keyframes tor-moon-tilt-click {
      0% { transform: rotate(0deg); filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0)); }
      44% { transform: rotate(-17deg); filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.45)); }
      66% { transform: rotate(-13deg); filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.32)); }
      88% { transform: rotate(2deg); }
      100% { transform: rotate(0deg); filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0)); }
    }
    #tor-dark-btn:hover .tor-icon-dark {
      animation: tor-moon-tilt 500ms ease-in-out;
    }
    #tor-dark-btn .tor-icon-dark.tor-anim-dark {
      animation: tor-moon-tilt-click 500ms ease-in-out;
    }

    @keyframes tor-star-hover-elastic {
      0% { transform: rotate(0deg) scale(1); }
      48% { transform: rotate(53deg) scale(1.2); }
      76% { transform: rotate(41deg) scale(1.12); }
      100% { transform: rotate(45deg) scale(1.15); }
    }
    .tor-legend-btn[data-tier="cold-custom"]:hover .tor-star-icon {
      transform: rotate(45deg) scale(1.15);
      filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.58));
      animation: tor-star-hover-elastic 420ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes tor-star-spin {
      0% { transform: rotate(0deg) scale(1); }
      48% { transform: rotate(86deg) scale(1.24); }
      74% { transform: rotate(67deg) scale(0.96); }
      100% { transform: rotate(72deg) scale(1); }
    }
    @keyframes tor-star-spin-hovered {
      0% { transform: rotate(45deg) scale(1.15); }
      48% { transform: rotate(131deg) scale(1.26); }
      74% { transform: rotate(112deg) scale(1.1); }
      100% { transform: rotate(117deg) scale(1.15); }
    }
    .tor-legend-btn[data-tier="cold-custom"].tor-anim-fav .tor-star-icon {
      animation: tor-star-spin 440ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .tor-legend-btn[data-tier="cold-custom"]:hover.tor-anim-fav .tor-star-icon {
      animation: tor-star-spin-hovered 440ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes tor-weight-bar-1 {
      0% { transform: translate(0, 0) scaleX(1); }
      38% { transform: translate(-1.5px, -2.4px) scaleX(1.08); }
      72% { transform: translate(0.6px, 0.7px) scaleX(0.97); }
      100% { transform: translate(0, 0) scaleX(1); }
    }
    @keyframes tor-weight-bar-2 {
      0% { transform: translate(0, 0) scaleX(1); }
      40% { transform: translate(2px, 1.6px) scaleX(0.88); }
      74% { transform: translate(-0.6px, -0.5px) scaleX(1.04); }
      100% { transform: translate(0, 0) scaleX(1); }
    }
    @keyframes tor-weight-bar-3 {
      0% { transform: translate(0, 0) scaleX(1); }
      42% { transform: translate(-1.4px, 2.4px) scaleX(1.16); }
      76% { transform: translate(0.5px, -0.6px) scaleX(0.95); }
      100% { transform: translate(0, 0) scaleX(1); }
    }
    #tor-weight-btn.tor-anim-sort .tor-weight-bar-1 {
      animation: tor-weight-bar-1 300ms cubic-bezier(0.22, 1, 0.36, 1) 0ms;
    }
    #tor-weight-btn.tor-anim-sort .tor-weight-bar-2 {
      animation: tor-weight-bar-2 300ms cubic-bezier(0.22, 1, 0.36, 1) 45ms;
    }
    #tor-weight-btn.tor-anim-sort .tor-weight-bar-3 {
      animation: tor-weight-bar-3 300ms cubic-bezier(0.22, 1, 0.36, 1) 85ms;
    }

    @keyframes tor-seeder-elevator {
      0% {
        transform: translateY(0);
        opacity: 1;
        filter: drop-shadow(0 0 0 rgba(74, 222, 128, 0));
      }
      34% {
        transform: translateY(-195%);
        opacity: 1;
        filter: drop-shadow(0 6px 2.5px rgba(74, 222, 128, 0.75));
      }
      35% {
        transform: translateY(-195%);
        opacity: 0;
      }
      38% {
        transform: translateY(195%);
        opacity: 0;
      }
      39% {
        transform: translateY(195%);
        opacity: 1;
        filter: drop-shadow(0 6px 2.5px rgba(74, 222, 128, 0.75));
      }
      76% {
        transform: translateY(-2.8px);
        opacity: 1;
        filter: drop-shadow(0 2px 1.5px rgba(220, 252, 231, 0.45));
      }
      90% {
        transform: translateY(0.8px);
        opacity: 1;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
        filter: drop-shadow(0 0 0 rgba(74, 222, 128, 0));
      }
    }
    @keyframes tor-speed-streak {
      0% {
        transform: translateY(0) scaleY(0.45);
        opacity: 0;
      }
      18% {
        opacity: var(--th-sl-op, 0.65);
      }
      44% {
        transform: translateY(52px) scaleY(1.55);
        opacity: 0;
      }
      50% {
        transform: translateY(-4px) scaleY(0.5);
        opacity: 0;
      }
      68% {
        opacity: calc(var(--th-sl-op, 0.65) * 0.85);
      }
      100% {
        transform: translateY(52px) scaleY(1.35);
        opacity: 0;
      }
    }
    #tor-seeds-btn.tor-anim-elevator .tor-icon-seeds {
      animation: tor-seeder-elevator 520ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    #tor-seeds-btn.tor-anim-elevator .th-speed-line-1 {
      animation: tor-speed-streak 510ms ease-out 0ms both;
    }
    #tor-seeds-btn.tor-anim-elevator .th-speed-line-2 {
      animation: tor-speed-streak 510ms ease-out 32ms both;
    }
    #tor-seeds-btn.tor-anim-elevator .th-speed-line-3 {
      animation: tor-speed-streak 510ms ease-out 14ms both;
    }
    #tor-seeds-btn.tor-anim-elevator .th-speed-line-4 {
      animation: tor-speed-streak 510ms ease-out 46ms both;
    }
    #tor-seeds-btn.tor-anim-elevator .th-speed-line-5 {
      animation: tor-speed-streak 510ms ease-out 22ms both;
    }
    #tor-seeds-btn.tor-anim-elevator .th-speed-line-6 {
      animation: tor-speed-streak 510ms ease-out 56ms both;
    }

    @keyframes tor-trash-stamp {
      0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(248, 113, 113, 0)); }
      24% { transform: scale(1.28); filter: drop-shadow(0 0 6px rgba(248, 113, 113, 0.65)); }
      52% { transform: scale(0.92); }
      76% { transform: scale(1.07); }
      100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(248, 113, 113, 0)); }
    }
    #tor-trash-btn .tor-icon-trash.tor-anim-stamp {
      animation: tor-trash-stamp 420ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes tor-click-pop {
      0% { transform: scale(1); }
      42% { transform: scale(0.95); }
      78% { transform: scale(1.025); }
      100% { transform: scale(1); }
    }
    .tor-clicked {
      animation: tor-click-pop 210ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .tor-meta-count {
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: #94a3b8;
      background: #121215;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 5px 9px;
      border-radius: 6px;
      transition: color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }
    @keyframes tor-merging-pulse {
      0%, 100% {
        opacity: 1;
        border-color: rgba(56, 189, 248, 0.32);
        box-shadow: 0 0 0 rgba(56, 189, 248, 0);
      }
      50% {
        opacity: 0.76;
        border-color: rgba(56, 189, 248, 0.58);
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.22);
      }
    }
    .tor-meta-count.tor-is-merging {
      color: #bae6fd;
      animation: tor-merging-pulse 1.15s ease-in-out infinite;
    }
    @keyframes tor-merge-done-pop {
      0% {
        transform: scale(1);
        border-color: rgba(52, 211, 153, 0.65);
        color: #ecfdf5;
        box-shadow: 0 0 12px rgba(52, 211, 153, 0.34);
      }
      38% {
        transform: scale(1.06);
        border-color: rgba(52, 211, 153, 0.72);
        color: #ecfdf5;
        box-shadow: 0 0 14px rgba(52, 211, 153, 0.38);
      }
      74% {
        transform: scale(0.99);
      }
      100% {
        transform: scale(1);
        border-color: rgba(255, 255, 255, 0.08);
        color: #94a3b8;
        box-shadow: 0 0 0 rgba(52, 211, 153, 0);
      }
    }
    .tor-meta-count.tor-merge-done {
      animation: tor-merge-done-pop 460ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .tor-search-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .tor-search-beam-clip {
      position: absolute;
      inset: 0;
      border-radius: 8px;
      overflow: hidden;
      pointer-events: none;
      z-index: 2;
    }
    .tor-search-scan-beam {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 48%;
      background: linear-gradient(105deg, transparent 0%, rgba(56, 189, 248, 0.24) 50%, transparent 100%);
      transform: translateX(-140%);
      opacity: 0;
      pointer-events: none;
    }
    @keyframes tor-search-scan-sweep {
      0% { transform: translateX(-140%); opacity: 0; }
      18% { opacity: 1; }
      82% { opacity: 1; }
      100% { transform: translateX(260%); opacity: 0; }
    }
    .tor-search-wrap.tor-is-scanning .tor-search-scan-beam {
      animation: tor-search-scan-sweep 750ms ease-in-out forwards;
    }
    @keyframes tor-search-icon-focus {
      0% { transform: scale(1) rotate(0deg); }
      45% { transform: scale(1.14) rotate(-10deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
    .tor-search-wrap.tor-is-scanning .tor-search-icon {
      animation: tor-search-icon-focus 420ms cubic-bezier(0.34, 1.4, 0.64, 1);
    }
    .tor-search-icon {
      position: absolute;
      left: 11px;
      color: #38bdf8;
      pointer-events: none;
      transform-origin: center;
      z-index: 3;
      transition: color 0.15s ease;
    }
    .tor-live-input {
      background: #121215;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 7px 32px 7px 32px;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 12.5px;
      width: 265px;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    .tor-live-input::placeholder {
      color: #64748b;
    }
    .tor-live-input:focus {
      background: #16161b;
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
    }
    .tor-live-clear {
      position: absolute;
      right: 7px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
    }
    .tor-live-clear[hidden] {
      display: none !important;
    }
    .tor-live-clear:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }
    .tor-live-clear:active {
      transform: scale(0.9);
    }

    .tor-badge {
      display: inline-block;
      padding: 1.5px 6px;
      margin: 1px 1.5px;
      border-radius: 5px;
      font-family: 'JetBrains Mono', monospace !important;
      font-weight: 700 !important;
      font-size: 11px !important;
      line-height: 1.3 !important;
      color: #ffffff !important;
      vertical-align: baseline;
      letter-spacing: -0.1px;
    }

    .tor-legend-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      margin: 0;
      cursor: pointer;
      transition: transform 0.12s ease, opacity 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
    }
    .tor-legend-btn:hover {
      transform: translateY(-1px);
      filter: brightness(1.12);
      opacity: 1 !important;
    }
    .tor-legend-btn:active {
      transform: scale(0.95) !important;
    }
    .tor-legend.has-filter .tor-legend-btn:not(.selected) {
      opacity: 0.42;
    }
    .tor-legend-btn.selected {
      opacity: 1;
      box-shadow: 0 0 0 2px #09090b, 0 0 0 3.5px #e2e8f0, 0 0 10px rgba(56, 189, 248, 0.32);
    }
    .tor-legend-btn[data-tier="cold-custom"].selected {
      box-shadow: 0 0 0 2px #09090b, 0 0 0 3.5px #38bdf8, 0 0 12px rgba(56, 189, 248, 0.48);
    }
    .tor-legend-reset {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      background: #18181f;
      color: #cbd5e1;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    }
    .tor-legend-reset[hidden] {
      display: none !important;
    }
    .tor-legend-reset:hover {
      background: #272732;
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
    }
    .tor-legend-reset:active {
      transform: scale(0.92);
    }

    .tor-tier-1 { background: #0284c7 !important; border: 1px solid #38bdf8 !important; }
    .tor-tier-2 { background: #059669 !important; border: 1px solid #34d399 !important; }
    .tor-tier-3 { background: #d97706 !important; border: 1px solid #fbbf24 !important; }
    .tor-tier-4 { background: #ea580c !important; border: 1px solid #fb923c !important; }
    .tor-tier-5 { background: #dc2626 !important; border: 1px solid #f87171 !important; }

    .tor-cold-custom {
      background: #4f46e5 !important;
      border: 1.5px solid #facc15 !important;
      color: #ffffff !important;
      box-shadow: 0 0 8px rgba(250, 204, 21, 0.45);
    }

    .tor-warm-bad {
      background: #991b1b !important;
      border: 1px solid #ef4444 !important;
      text-decoration: line-through;
    }

    table.tor-dark-table tbody tr.tor-row-priority,
    tr.tor-row-priority {
      box-shadow: inset 4px 0 0 0 #facc15 !important;
      background-color: rgba(250, 204, 21, 0.065) !important;
      background-image: linear-gradient(90deg, rgba(250, 204, 21, 0.12) 0%, rgba(245, 158, 11, 0.04) 58%, rgba(245, 158, 11, 0.01) 100%) !important;
    }
    table.tor-dark-table tbody tr.tor-row-priority > td:first-child,
    tr.tor-row-priority > td:first-child {
      box-shadow: inset 4px 0 0 0 #facc15 !important;
    }
    table.tor-dark-table tbody tr.tor-row-priority:hover,
    tr.tor-row-priority:hover {
      box-shadow: inset 4px 0 0 0 #fde047 !important;
      background-color: rgba(250, 204, 21, 0.11) !important;
      background-image: linear-gradient(90deg, rgba(250, 204, 21, 0.18) 0%, rgba(245, 158, 11, 0.075) 62%, rgba(245, 158, 11, 0.025) 100%) !important;
    }
    table.tor-dark-table tbody tr.tor-row-priority:hover > td:first-child,
    tr.tor-row-priority:hover > td:first-child {
      box-shadow: inset 4px 0 0 0 #fde047 !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-row-priority {
      box-shadow: inset 4px 0 0 0 #eab308 !important;
      background-color: rgba(250, 204, 21, 0.12) !important;
      background-image: linear-gradient(90deg, rgba(250, 204, 21, 0.18) 0%, rgba(250, 204, 21, 0.05) 65%, rgba(250, 204, 21, 0.015) 100%) !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-row-priority > td {
      background-color: transparent !important;
      background-image: none !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-row-priority > td:first-child {
      box-shadow: inset 4px 0 0 0 #eab308 !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-row-priority:hover {
      box-shadow: inset 4px 0 0 0 #ca8a04 !important;
      background-color: rgba(250, 204, 21, 0.18) !important;
      background-image: linear-gradient(90deg, rgba(250, 204, 21, 0.24) 0%, rgba(250, 204, 21, 0.09) 65%, rgba(250, 204, 21, 0.03) 100%) !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-row-priority:hover > td:first-child {
      box-shadow: inset 4px 0 0 0 #ca8a04 !important;
    }

    table.tor-dark-table tbody tr.tor-row-live,
    tr.tor-row-live {
      box-shadow: inset 5px 0 0 0 #facc15 !important;
      background: linear-gradient(90deg, rgba(250, 204, 21, 0.14), rgba(250, 204, 21, 0.03)) !important;
    }
    table.tor-dark-table tbody tr.tor-row-match,
    tr.tor-row-match {
      box-shadow: inset 4px 0 0 0 #38bdf8 !important;
      background-color: rgba(56, 189, 248, 0.07) !important;
    }
    table.tor-dark-table tbody tr.tor-row-match:hover,
    tr.tor-row-match:hover {
      background-color: rgba(56, 189, 248, 0.12) !important;
    }

    tr.tor-row-trash {
      opacity: 0.22 !important;
      filter: grayscale(85%);
      transition: opacity 0.2s ease;
    }
    tr.tor-row-trash:hover {
      opacity: 0.9 !important;
      filter: none;
    }
    table.tor-hide-trash tr.tor-row-trash {
      display: none !important;
    }
    tr.tor-row-filtered {
      display: none !important;
    }

    @keyframes tor-empty-row-in {
      0% { opacity: 0; transform: translateY(-4px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    table.tor-enhanced tbody tr.tor-empty-trash-row,
    table.tor-dark-table tbody tr.tor-empty-trash-row {
      cursor: pointer !important;
      transition: background-color 0.14s ease !important;
      animation: tor-empty-row-in 240ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    table.tor-enhanced tbody tr.tor-empty-trash-row:hover .tor-empty-trash-kbd {
      transform: translateY(-1px);
      border-color: rgba(248, 113, 113, 0.45);
    }
    table.tor-dark-table tbody tr.tor-empty-trash-row:hover {
      background-color: rgba(248, 113, 113, 0.08) !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-empty-trash-row:hover {
      background-color: rgba(220, 38, 38, 0.06) !important;
    }
    table.tor-enhanced tbody tr.tor-empty-trash-row > td.tor-empty-trash-cell {
      padding: 18px 16px !important;
      text-align: center !important;
      font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
      font-size: 12.5px !important;
      font-weight: 500 !important;
      color: #94a3b8 !important;
      cursor: pointer !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr.tor-empty-trash-row > td.tor-empty-trash-cell {
      color: #475569 !important;
    }
    .tor-empty-trash-inner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
      line-height: 1.5;
    }
    .tor-empty-trash-accent {
      color: #fca5a5;
      font-weight: 600;
    }
    table.tor-enhanced:not(.tor-dark-table) .tor-empty-trash-accent {
      color: #b91c1c;
    }
    .tor-empty-trash-kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #f8fafc;
      transition: transform 140ms ease, border-color 140ms ease;
    }
    table.tor-enhanced:not(.tor-dark-table) .tor-empty-trash-kbd {
      background: rgba(15, 23, 42, 0.06);
      border-color: rgba(15, 23, 42, 0.18);
      color: #0f172a;
    }

    table.tor-enhanced a.tor-cc-btn {
      position: relative !important;
      top: 0px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
      margin: 0 0 0 5px !important;
      padding: 0 !important;
      line-height: 0 !important;
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      flex-shrink: 0 !important;
      cursor: pointer !important;
      color: rgba(156, 163, 175, 0.55) !important;
      text-decoration: none !important;
      opacity: 1 !important;
      transition: color 0.14s ease, transform 0.16s ease, filter 0.16s ease !important;
    }
    table.tor-enhanced a.tor-cc-btn svg {
      display: block !important;
      width: 20px !important;
      height: 20px !important;
      min-width: 20px !important;
      min-height: 20px !important;
      margin: 0 !important;
      padding: 0 !important;
      flex-shrink: 0 !important;
    }
    table.tor-enhanced:not(.tor-dark-table) a.tor-cc-btn {
      color: rgba(100, 116, 139, 0.6) !important;
    }
    table.tor-enhanced tbody tr:hover a.tor-cc-btn,
    table.tor-enhanced tr:hover a.tor-cc-btn {
      color: #c4b5fd !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover a.tor-cc-btn,
    table.tor-enhanced:not(.tor-dark-table) tr:hover a.tor-cc-btn {
      color: #8b5cf6 !important;
    }
    table.tor-enhanced tbody tr:hover a.tor-cc-btn:hover,
    table.tor-enhanced tr:hover a.tor-cc-btn:hover,
    table.tor-enhanced a.tor-cc-btn:hover,
    table.tor-enhanced a.tor-cc-btn:focus-visible {
      background: transparent !important;
      border: none !important;
      color: #a855f7 !important;
      transform: scale(1.08) !important;
      filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.58)) !important;
      outline: none !important;
    }
    table.tor-enhanced:not(.tor-dark-table) tbody tr:hover a.tor-cc-btn:hover,
    table.tor-enhanced:not(.tor-dark-table) tr:hover a.tor-cc-btn:hover,
    table.tor-enhanced:not(.tor-dark-table) a.tor-cc-btn:hover,
    table.tor-enhanced:not(.tor-dark-table) a.tor-cc-btn:focus-visible {
      background: transparent !important;
      border: none !important;
      color: #7c3aed !important;
      transform: scale(1.08) !important;
      filter: drop-shadow(0 0 6px rgba(124, 58, 237, 0.45)) !important;
      outline: none !important;
    }
    table.tor-enhanced tbody tr:hover a.tor-cc-btn:active,
    table.tor-enhanced tr:hover a.tor-cc-btn:active,
    table.tor-enhanced a.tor-cc-btn:active {
      transform: scale(0.92) !important;
    }

    @keyframes tor-cc-hover-pop-anim {
      0% { transform: scale(1); }
      45% { transform: scale(1.18); }
      100% { transform: scale(1.08); }
    }
    table.tor-enhanced a.tor-cc-btn.tor-cc-hover-pop {
      animation: tor-cc-hover-pop-anim 320ms cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    @keyframes tor-cc-pop-anim {
      0% { transform: scale(1); }
      28% { transform: scale(0.82); }
      64% { transform: scale(1.28); }
      100% { transform: scale(1); }
    }
    table.tor-enhanced a.tor-cc-btn.tor-cc-pop {
      animation: tor-cc-pop-anim 380ms cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }

    #tor-fx-layer {
      position: fixed !important;
      inset: 0 !important;
      pointer-events: none !important;
      overflow: hidden !important;
      z-index: 2147483647 !important;
    }
    .tor-cc-sparkle {
      position: fixed !important;
      display: block !important;
      pointer-events: none !important;
      will-change: transform, opacity;
      filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.72)) !important;
      opacity: 0;
    }
    .tor-cc-dot {
      position: fixed !important;
      display: block !important;
      border-radius: 50% !important;
      pointer-events: none !important;
      will-change: transform, opacity;
      box-shadow: 0 0 6px rgba(196, 181, 253, 0.85) !important;
      opacity: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      #tor-control-bar *,
      #tor-control-bar *::before,
      #tor-control-bar *::after,
      table.tor-enhanced tbody tr,
      table.tor-enhanced tbody tr td.tor-cell-size,
      table.tor-enhanced a.tor-cc-btn,
      table.tor-enhanced tr.tor-empty-trash-row,
      .tor-cc-sparkle,
      .tor-cc-dot {
        animation-duration: 0.001ms !important;
        animation-delay: 0ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}

const TOR_REDUCED_MOTION_QUERY =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

function torPrefersReducedMotion() {
  return Boolean(TOR_REDUCED_MOTION_QUERY && TOR_REDUCED_MOTION_QUERY.matches);
}

function triggerElementAnim(el, className, fallbackMs = 450, targetSelector = null) {
  if (!el || torPrefersReducedMotion()) return;
  if (el._torAnimTimers && el._torAnimTimers[className]) {
    clearTimeout(el._torAnimTimers[className]);
  }
  el.classList.remove(className);
  void el.getBoundingClientRect();
  el.classList.add(className);

  let done = false;
  const clear = () => {
    if (done) return;
    done = true;
    el.classList.remove(className);
  };
  const listenTarget = (targetSelector && el.querySelector(targetSelector)) || el;
  listenTarget.addEventListener('animationend', clear, { once: true });
  el._torAnimTimers = el._torAnimTimers || {};
  el._torAnimTimers[className] = setTimeout(clear, fallbackMs);
}

function triggerClickFeedback(el) {
  triggerElementAnim(el, 'tor-clicked', 260);
}

function getTorFxLayer() {
  let layer = document.getElementById('tor-fx-layer');
  if (!layer && document.body) {
    layer = document.createElement('div');
    layer.id = 'tor-fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

const torActiveParticles = [];
let torParticleRafId = 0;

function stepTorParticles(now) {
  for (let i = torActiveParticles.length - 1; i >= 0; i--) {
    const p = torActiveParticles[i];
    if (p.cleaned) {
      torActiveParticles.splice(i, 1);
      continue;
    }
    if (now < p.spawnAt) continue;

    if (!p.started) {
      p.started = true;
      p.lastTime = now;
    }

    const elapsed = now - p.spawnAt;
    const progress = elapsed / p.life;
    if (progress >= 1) {
      p.cleanup();
      torActiveParticles.splice(i, 1);
      continue;
    }

    const dt = Math.min(0.05, Math.max(0.001, (now - p.lastTime) / 1000));
    p.lastTime = now;

    const dragFactor = Math.pow(p.drag, dt);
    p.vx *= dragFactor;
    p.vy = p.vy * dragFactor + p.driftY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vRot * dt;

    let scale;
    if (progress < 0.26) {
      const t = progress / 0.26;
      scale = 0.2 + 0.9 * (1 - Math.pow(1 - t, 3));
    } else if (progress < 0.56) {
      scale = 1.1 - ((progress - 0.26) / 0.3) * 0.12;
    } else {
      scale = 0.98 - ((progress - 0.56) / 0.44) * 0.65;
    }

    let opacity;
    if (progress < 0.1) {
      opacity = progress / 0.1;
    } else if (progress < 0.5) {
      opacity = 1;
    } else {
      opacity = Math.max(0, 1 - (progress - 0.5) / 0.5);
    }

    p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${p.rot.toFixed(1)}deg)`;
    p.el.style.opacity = opacity.toFixed(3);
  }

  if (torActiveParticles.length > 0) {
    torParticleRafId = window.requestAnimationFrame(stepTorParticles);
  } else {
    torParticleRafId = 0;
  }
}

function spawnCcSparkles(ccBtn, mode = 'click') {
  if (!ccBtn || torPrefersReducedMotion()) return;
  if (mode === 'hover') {
    triggerElementAnim(ccBtn, 'tor-cc-hover-pop', 380);
  } else {
    triggerElementAnim(ccBtn, 'tor-cc-pop', 460);
  }

  const layer = getTorFxLayer();
  if (!layer) return;

  const rect = ccBtn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#a855f7', '#c4b5fd', '#ddd6fe', '#f5f3ff'];
  const count = 18 + Math.floor(Math.random() * 7);
  const now = performance.now();

  for (let i = 0; i < count; i++) {
    const isDot = i % 3 === 1;
    const color = colors[i % colors.length];
    const targetDist = 14 + Math.random() * 24;
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
    const delay = Math.round((i / Math.max(1, count - 1)) * 195 + Math.random() * 45);
    const life = 600 + Math.round(Math.random() * 380);
    const drag = 0.03 + Math.random() * 0.035;
    const dragDecayRate = -Math.log(drag);
    const initSpeed = (targetDist * dragDecayRate) / Math.max(0.5, 1 - Math.pow(drag, life / 1000));

    let el;
    if (isDot) {
      const size = 3 + Math.round(Math.random() * 2.5);
      el = document.createElement('span');
      el.className = 'tor-cc-dot';
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.backgroundColor = color;
    } else {
      const size = 7 + Math.round(Math.random() * 5.5);
      el = createSvgNode('svg', {
        class: 'tor-cc-sparkle',
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        'aria-hidden': 'true'
      });
      el.appendChild(
        createSvgNode('circle', {
          cx: 12,
          cy: 12,
          r: 3.1,
          fill: color
        })
      );
      el.appendChild(
        createSvgNode('path', {
          d: 'M12 1 L14.5 9.5 L23 12 L14.5 14.5 L12 23 L9.5 14.5 L1 12 L9.5 9.5 Z',
          fill: color
        })
      );
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
    }

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -50%) scale(0.2)`;
    layer.appendChild(el);

    const totalRot = (120 + Math.random() * 140) * (Math.random() < 0.5 ? -1 : 1);
    const vRot = totalRot / (life / 1000);

    const particle = {
      el,
      x: cx + (Math.random() - 0.5) * 4,
      y: cy + (Math.random() - 0.5) * 4,
      vx: Math.cos(angle) * initSpeed,
      vy: Math.sin(angle) * initSpeed,
      driftY: -5 + Math.random() * 10,
      drag,
      rot: Math.random() * 30 - 15,
      vRot,
      spawnAt: now + delay,
      life,
      started: false,
      lastTime: now + delay,
      cleaned: false,
      cleanup: null
    };

    particle.cleanup = () => {
      if (particle.cleaned) return;
      particle.cleaned = true;
      el.remove();
    };
    el.addEventListener('animationend', particle.cleanup, { once: true });
    setTimeout(particle.cleanup, delay + life + 220);

    torActiveParticles.push(particle);
  }

  if (!torParticleRafId && torActiveParticles.length > 0) {
    torParticleRafId = window.requestAnimationFrame(stepTorParticles);
  }
}

function findTorrentTable(doc = document) {
  const known =
    doc.querySelector('table.torrent-list') ||
    doc.querySelector('table.table-list') ||
    doc.querySelector('table.table2');
  if (known) return known;

  const candidates = Array.from(doc.querySelectorAll('table')).filter(
    t => t.querySelectorAll('tr').length > 3
  );
  if (candidates.length === 0) return null;

  const withSizes = candidates.filter(t =>
    /\b\d+(?:[.,]\d+)?\s*(?:TiB|GiB|MiB|KiB|TB|GB|MB|KB)\b/i.test(t.textContent)
  );
  const pool = withSizes.length > 0 ? withSizes : candidates;
  pool.sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length);
  return pool[0];
}

function detectTableColumns(table) {
  const isNyaa = table.classList.contains('torrent-list');
  const meta = {
    isNyaa,
    sizeIdx: -1,
    seedIdx: -1,
    leechIdx: -1,
    uploaderIdx: -1
  };

  if (isNyaa) {
    meta.sizeIdx = 3;
    meta.seedIdx = 5;
    meta.leechIdx = 6;
    return meta;
  }

  const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
  if (!headerRow) return meta;

  const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
  headerCells.forEach((cell, idx) => {
    const textTrim = cell.textContent.trim();
    const nestedTitle = cell.querySelector('[title]')?.getAttribute('title') || '';
    const nestedAria = cell.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
    const label = `${textTrim} ${cell.getAttribute('title') || ''} ${cell.getAttribute('aria-label') || ''} ${nestedTitle} ${nestedAria} ${cell.className || ''}`.trim();
    if (meta.sizeIdx === -1 && /\b(size|taille|poids|length|hdr-size)\b/i.test(label)) {
      meta.sizeIdx = idx;
    } else if (meta.seedIdx === -1 && (/\b(seeders?|seeds?|se|hdr-seeders|sources?)\b/i.test(label) || /^s$/i.test(textTrim))) {
      meta.seedIdx = idx;
    } else if (meta.leechIdx === -1 && (/\b(leechers?|leeches?|le|peers?|hdr-leechers)\b/i.test(label) || /^l$/i.test(textTrim))) {
      meta.leechIdx = idx;
    } else if (meta.uploaderIdx === -1 && /\b(uploader|uploaded|user|author|poster)\b/i.test(label)) {
      meta.uploaderIdx = idx;
    }
  });

  return meta;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pre-sort direct 1337x searches by size once; skip when 'order' is already set to prevent redirect loops
function maybeRedirect1337xSortBySize() {
  try {
    const url = new URL(window.location.href);
    if (!is1337xHost(url.hostname)) return false;
    if (!/^\/search\/?$/i.test(url.pathname)) return false;
    if (!(url.searchParams.get('q') || '').trim()) return false;
    if (url.searchParams.has('order')) return false;
    url.searchParams.set('order', 'length');
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

function parseLiveQuery(liveQuery) {
  const includeTerms = [];
  const excludeTerms = [];
  if (!liveQuery || !liveQuery.trim()) {
    return { includeTerms, excludeTerms, hasFilter: false };
  }

  const tokens = liveQuery
    .trim()
    .slice(0, 120)
    .split(/[\s,]+/)
    .filter(Boolean);

  for (const tok of tokens) {
    if (tok.startsWith('-')) {
      if (tok.length >= 2) {
        excludeTerms.push(tok.slice(1).toLowerCase());
      }
    } else {
      includeTerms.push(tok.toLowerCase());
    }
  }

  return {
    includeTerms,
    excludeTerms,
    hasFilter: includeTerms.length > 0 || excludeTerms.length > 0
  };
}

function isEditableElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(el.isContentEditable);
}

// Split tokens before escaping to avoid ReDoS and reuse CONTEXTUAL_TAG_REGEXES on homonymous tags
function buildSafeCustomRules(tagList, category, extraProps = {}) {
  const plainPatterns = [];
  const rules = [];
  const seenContextual = new Set();

  (tagList || [])
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .forEach(t => {
      const upperKey = t.toUpperCase();
      if (Object.prototype.hasOwnProperty.call(CONTEXTUAL_TAG_REGEXES, upperKey)) {
        if (!seenContextual.has(upperKey)) {
          seenContextual.add(upperKey);
          rules.push({
            category,
            ...extraProps,
            regex: CONTEXTUAL_TAG_REGEXES[upperKey]
          });
        }
        return;
      }
      const parts = t.split(/[\s._-]+/).filter(Boolean).map(escapeRegExp);
      if (parts.length > 0) {
        plainPatterns.push(parts.join('[\\s._-]?'));
      }
    });

  if (plainPatterns.length > 0) {
    plainPatterns.sort((a, b) => b.length - a.length);
    rules.unshift({
      category,
      ...extraProps,
      regex: new RegExp(
        `(?<![a-zA-Z0-9])(${plainPatterns.join('|')})(?:(?![a-zA-Z0-9])|(?=[12]\\.0(?![a-zA-Z0-9])|[567]\\.1(?![a-zA-Z0-9])))`,
        'gi'
      )
    });
  }

  return rules;
}

function formatUrlSlug(slug) {
  let s = slug
    .replace(/-torrent-\d+\.html$/i, '')
    .replace(/HDR10\+/gi, 'HDR10__PLUS')
    .replace(/DD\+/gi, 'DD__PLUS')
    .replace(/\+/g, ' ');

  const compoundMap = [
    [/\bUHD-REMUX\b/gi, 'UHD__REMUX'],
    [/\bBD-REMUX\b/gi, 'BD__REMUX'],
    [/\bDVD-REMUX\b/gi, 'DVD__REMUX'],
    [/\bWEB-DL\b/gi, 'WEB__DL'],
    [/\bWEB-MUX\b/gi, 'WEB__MUX'],
    [/\bWEB-RIP\b/gi, 'WEB__RIP'],
    [/\bDTS-HD\b/gi, 'DTS__HD'],
    [/\bDTS-X\b/gi, 'DTS__X'],
    [/\bDTS-ES\b/gi, 'DTS__ES'],
    [/\bAURO-3D\b/gi, 'AURO__3D'],
    [/\bBLU-RAY\b/gi, 'BLU__RAY'],
    [/\bOPEN-MATTE\b/gi, 'OPEN__MATTE'],
    [/\bE-AC-3\b/gi, 'E__AC__3'],
    [/\bAC-3\b/gi, 'AC__3'],
    [/\bHE-AAC\b/gi, 'HE__AAC'],
    [/\bHD-TS\b/gi, 'HD__TS'],
    [/\bHD-TC\b/gi, 'HD__TC'],
    [/\bH-SBS\b/gi, 'H__SBS'],
    [/\bH-OU\b/gi, 'H__OU'],
    [/\bD-Z0N3\b/gi, 'D__Z0N3'],
    [/\bBEN-THE-MEN\b/gi, 'BEN__THE__MEN'],
    [/\bBEATRICE-RAWS\b/gi, 'BEATRICE__RAWS'],
    [/\bKAWAIIKA-RAWS\b/gi, 'KAWAIIKA__RAWS'],
    [/\bKAWAIKA-RAWS\b/gi, 'KAWAIKA__RAWS'],
    [/\bANK-RAWS\b/gi, 'ANK__RAWS'],
    [/\bLOWPOWER-RAWS\b/gi, 'LOWPOWER__RAWS'],
    [/\bSNOW-RAWS\b/gi, 'SNOW__RAWS'],
    [/\bOKAY-SUBS\b/gi, 'OKAY__SUBS'],
    [/\bERAI-RAWS\b/gi, 'ERAI__RAWS'],
    [/\bTSUNDERE-RAWS\b/gi, 'TSUNDERE__RAWS'],
    [/\bVCB-STUDIO\b/gi, 'VCB__STUDIO'],
    [/\bMULTI-SUBS\b/gi, 'MULTI__SUBS'],
    [/\bMULTI-AUDIO\b/gi, 'MULTI__AUDIO'],
    [/\bDUAL-AUDIO\b/gi, 'DUAL__AUDIO'],
    [/\bTRIPLE-AUDIO\b/gi, 'TRIPLE__AUDIO'],
    [/\bAI-UPSCALED\b/gi, 'AI__UPSCALED'],
    [/\bAI-UPSCALE\b/gi, 'AI__UPSCALE'],
    [/\bAI-ENHANCED\b/gi, 'AI__ENHANCED'],
    [/\b24-BIT\b/gi, '24__BIT'],
    [/\b12-BITS\b/gi, '12__BITS'],
    [/\b12-BIT\b/gi, '12__BIT'],
    [/\b10-BITS\b/gi, '10__BITS'],
    [/\b10-BIT\b/gi, '10__BIT'],
    [/\b8-BITS\b/gi, '8__BITS'],
    [/\b8-BIT\b/gi, '8__BIT'],
    [/\b7-1\b/g, '7.1'],
    [/\b6-1\b/g, '6.1'],
    [/\b5-1\b/g, '5.1'],
    [/\b2-0\b/g, '2.0'],
    [/\bH-266\b/gi, 'H.266'],
    [/\bH-265\b/gi, 'H.265'],
    [/\bH-264\b/gi, 'H.264'],
    [/-mkv$/i, '.mkv'],
    [/-mp4$/i, '.mp4']
  ];

  compoundMap.forEach(([rgx, rep]) => {
    s = s.replace(rgx, rep);
  });

  // Preserve the leading hyphen of the final release group before converting remaining hyphens to spaces
  s = s.replace(/-(?=[A-Za-z0-9]+(?:\.(?:mkv|mp4))?$)/, ' __');
  s = s.replace(/-/g, ' ');
  s = s.replace(/__PLUS/g, '+').replace(/__/g, '-');
  s = s.replace(/(?<![.\s-mM])kv$/i, '.mkv');
  return s.replace(/\s{2,}/g, ' ').trim();
}

function parseSizeText(txt) {
  const m = txt.match(/([\d.,]+)\s*(TiB|GiB|MiB|KiB|TB|GB|MB|KB)\b/i);
  if (!m) return null;
  let numStr = m[1];
  if (numStr.includes(',') && numStr.includes('.')) {
    numStr = numStr.replace(/,/g, '');
  } else if (numStr.includes(',') && /,\d{1,2}$/.test(numStr)) {
    numStr = numStr.replace(',', '.');
  } else {
    numStr = numStr.replace(/,/g, '');
  }
  const val = parseFloat(numStr);
  if (isNaN(val)) return null;
  const unit = m[2].toUpperCase();
  if (unit.startsWith('T')) return val * 1024 * 1024;
  if (unit.startsWith('G')) return val * 1024;
  if (unit.startsWith('M')) return val;
  if (unit.startsWith('K')) return val / 1024;
  return null;
}

function parseSeedsText(txt) {
  if (!txt) return null;
  const m = String(txt).trim().match(/^\d(?:[\d,\s\u00a0.]*\d)?/);
  if (!m) return null;
  const val = parseInt(m[0].replace(/[,\s\u00a0.]/g, ''), 10);
  return isNaN(val) ? null : val;
}

function cleanReleaseTitleForSubtitles(rawTitle) {
  if (!rawTitle) return '';
  let s = String(rawTitle).trim();

  s = s.replace(/\.(?:mkv|mp4|avi|ts|m2ts|mov|wmv|flv|webm)$/i, '');
  s = s.replace(/\[[^\]]*\]/g, ' ');

  s = s.replace(/\(([^)]*)\)/g, (_, inner) => {
    const trimmed = inner.trim();
    if (/^(?:19\d{2}|20[0-3]\d)$/.test(trimmed) || /^(?:season|saison)\s*\d{1,2}$/i.test(trimmed)) {
      return ` ${trimmed} `;
    }
    if (
      /\b(?:4320p|2160p|1440p|1080[pi]|720p|576p|480p|4k|8k|uhd|bluray|blu-ray|web-?dl|web-?rip|remux|hevc|x265|x264|h\.?26[456]|av1|vvc|10-?bits?|8-?bits?|aac|flac|opus|dts|truehd|atmos|ddp|eac3|ac3|dual|multi|sub|cr|hdr|dv)\b/i.test(
        trimmed
      )
    ) {
      return ' ';
    }
    return ` ${trimmed} `;
  });

  s = s.replace(/[._]+/g, ' ');
  s = s.replace(/\s+-\s+/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();

  const epMatch = s.match(/\b(S\d{1,2}E\d{1,3}(?:-?E\d{1,3})?|\d{1,2}x\d{2})\b/i);
  if (epMatch && epMatch.index > 0) {
    const before = s.slice(0, epMatch.index).trim();
    const epCode = epMatch[1].toUpperCase();
    return `${before} ${epCode}`.replace(/\s{2,}/g, ' ').trim();
  }

  const seasonMatch = s.match(/\b(S\d{1,2}|(?:Season|Saison)\s+\d{1,2})\b/i);
  if (seasonMatch && seasonMatch.index > 0) {
    const before = s.slice(0, seasonMatch.index).trim();
    const seasonToken = /^s\d/i.test(seasonMatch[1]) ? seasonMatch[1].toUpperCase() : seasonMatch[1];
    return `${before} ${seasonToken}`.replace(/\s{2,}/g, ' ').trim();
  }

  // Match the last year after index 0 so numeric titles like "1917" or "Blade Runner 2049" stay intact
  const yearMatches = [...s.matchAll(/\b(19\d{2}|20[0-3]\d)\b/g)].filter(m => m.index > 0);
  if (yearMatches.length > 0) {
    const lastYear = yearMatches[yearMatches.length - 1];
    const cutoff = s.slice(0, lastYear.index + lastYear[0].length);
    return cutoff.replace(/[\s-]+$/, '').replace(/\s{2,}/g, ' ').trim();
  }

  const techCutoff = s.match(
    /(?<![a-zA-Z0-9])(?:4320p|8k|2160p|4k|uhd|1440p|1080[pi]|720p|576p|480p|360p|240p|remux|bdremux|bluray|blu-ray|web-?dl|web-?rip|web-?mux|bdrip|brrip|hdrip|dvdrip|hdtv|hdcam|camrip|hdts|hdtc|hdlight|4klight|minihd|microhd|mhd|hdr10\+|hdr10|hdr|hlg|dolby\s+vision|dovi|dv|hevc|x265|h\s?265|x264|h\s?264|av1|vp9|vvc|x266|h\s?266|xvid|divx|12-?bits?|10-?bits?|8-?bits?|truehd|atmos|dts-?hd|dts|flac|opus|ddpa?|dd\+|e-?ac-?3|ac-?3|aac|multi\d*|truefrench|subfrench|french|vff|vfi|vfq|vostfr|vosta|dual\s+audio|int[eé]grale|extended|unrated|remastered|proper|repack|imax|open\s+matte|hybrid|complete|batch)(?![a-zA-Z0-9])/i
  );
  if (techCutoff && techCutoff.index > 1) {
    s = s.slice(0, techCutoff.index);
  }

  s = s.replace(/-[A-Za-z0-9]+$/, '').replace(/[\s-]+$/, '').replace(/\s{2,}/g, ' ').trim();
  return s || String(rawTitle).replace(/[._]+/g, ' ').trim();
}

function updateRowSubtitleButton(titleCell, titleLink, rawTitle, subtitleSettings, subtitleProviders) {
  if (!titleCell || !rawTitle) return;
  titleCell.classList.add('tor-title-cell');

  if (titleCell.dataset.subRawTitle !== rawTitle) {
    titleCell.dataset.subRawTitle = rawTitle;
    titleCell.dataset.subQuery = normalizeSearchQuery(cleanReleaseTitleForSubtitles(rawTitle));
  }

  const cleanQuery = titleCell.dataset.subQuery;
  const providers = resolveSubtitleProviders(subtitleProviders, subtitleSettings);
  const resolved = resolveSubtitleSettings(subtitleSettings);
  const entries = buildSubtitleSearchUrls(cleanQuery, resolved, providers);
  if (entries.length === 0) return;

  const urls = entries.map(entry => entry.url);
  const providerNames = entries.map(entry => entry.provider.name).join(', ');
  const langLabel = formatSubtitleLangLabel(resolved);

  let ccBtn = titleCell.querySelector('a.tor-cc-btn');
  if (!ccBtn) {
    ccBtn = document.createElement('a');
    ccBtn.className = 'tor-cc-btn';
    ccBtn.target = '_blank';
    ccBtn.rel = 'noopener noreferrer';
    ccBtn.appendChild(createSvgIcon('cc'));
    ccBtn.addEventListener('mouseenter', () => {
      const now = Date.now();
      if (ccBtn._lastHoverSparkle && now - ccBtn._lastHoverSparkle < 650) return;
      ccBtn._lastHoverSparkle = now;
      spawnCcSparkles(ccBtn, 'hover');
    });
    ccBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ccBtn._lastHoverSparkle = Date.now();
      spawnCcSparkles(ccBtn, 'click');
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const targetUrls = Array.isArray(ccBtn._subUrls) ? ccBtn._subUrls : [];
      if (targetUrls.length === 0) return;
      e.preventDefault();
      const openSubtitles = () => {
        if (extApi && extApi.runtime && typeof extApi.runtime.sendMessage === 'function') {
          Promise.resolve(extApi.runtime.sendMessage({ type: 'openSubtitleTabs', urls: targetUrls }))
            .then(res => {
              if (res && res.ok === false) {
                window.open(targetUrls[0], '_blank', 'noopener,noreferrer');
              }
            })
            .catch(() => {
              window.open(targetUrls[0], '_blank', 'noopener,noreferrer');
            });
        } else {
          window.open(targetUrls[0], '_blank', 'noopener,noreferrer');
        }
      };
      if (torPrefersReducedMotion()) {
        openSubtitles();
      } else {
        setTimeout(openSubtitles, 150);
      }
    });
    if (titleLink && titleLink.parentNode) {
      titleLink.insertAdjacentElement('afterend', ccBtn);
    } else {
      titleCell.appendChild(ccBtn);
    }
  }

  ccBtn._subUrls = urls;
  ccBtn.href = urls[0];
  ccBtn.title = `Subtitles (${providerNames} - ${langLabel}): ${cleanQuery}`;
  ccBtn.setAttribute('aria-label', ccBtn.title);
}

function getTitleLinkAndRestoreFullText(row, isNyaa = false) {
  let torrentLink = null;
  let cell = null;

  if (isNyaa) {
    cell = row.querySelector('td[colspan="2"]');
    if (cell) {
      const nyaaLinks = Array.from(cell.querySelectorAll('a:not(.comments):not(.tor-cc-btn)'));
      torrentLink =
        nyaaLinks.find(a => {
          const href = a.getAttribute('href') || '';
          return !href.includes('#comments') && !href.endsWith('.torrent') && !href.startsWith('magnet:');
        }) || nyaaLinks[nyaaLinks.length - 1];
    }
  }

  if (!torrentLink) {
    cell = row.querySelector('td.name, td.coll-1, .tt-name, td[colspan="2"]');
    if (cell) {
      const links = Array.from(cell.querySelectorAll('a:not(.tor-cc-btn)'));
      torrentLink =
        links.find(a => {
          const href = a.getAttribute('href') || '';
          return href.startsWith('/torrent/') && !a.classList.contains('icon');
        }) ||
        links.find(a => {
          const href = a.getAttribute('href') || '';
          return (
            !a.classList.contains('icon') &&
            !a.classList.contains('comments') &&
            !a.classList.contains('csprite_dl14') &&
            !href.includes('#comments') &&
            !href.endsWith('.torrent') &&
            !href.startsWith('magnet:') &&
            a.textContent.trim().length > 3
          );
        }) ||
        links[links.length - 1];
    }
  }

  // Generic fallback for custom trackers displaying tabular release rows
  if (!torrentLink) {
    const allLinks = Array.from(row.querySelectorAll('td a:not(.tor-cc-btn)')).filter(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim();
      if (!text || text.length <= 3) return false;
      if (href.startsWith('magnet:') || href.endsWith('.torrent') || href.includes('#comments')) return false;
      if (a.classList.contains('icon') || a.classList.contains('comments')) return false;
      if (/^\d+$/.test(text) || parseSizeText(text) !== null) return false;
      return true;
    });

    if (allLinks.length === 0) return null;

    torrentLink =
      allLinks.find(a => /\/(torrent|view|details?|release|t)\b/i.test(a.getAttribute('href') || '')) ||
      allLinks.sort((a, b) => b.textContent.trim().length - a.textContent.trim().length)[0];
    cell = torrentLink.closest('td');
  }

  if (!torrentLink) return null;
  torrentLink.classList.add('tor-title-link');

  if (!torrentLink.dataset.rawTitle) {
    const visibleText = torrentLink.textContent.trim().replace(/(?<![.\s-mM])kv$/i, '.mkv');
    let fullTitle = visibleText;
    const titleAttr = (torrentLink.getAttribute('title') || '').trim();
    const isTruncated = /(\.\.+|…)$/.test(visibleText);
    const cleanVisible = visibleText.replace(/(\.\.+|…)$/, '').trim();

    if (titleAttr) {
      if (isNyaa && titleAttr.length >= cleanVisible.length) {
        fullTitle = titleAttr;
      } else if (
        isTruncated &&
        titleAttr.length > cleanVisible.length &&
        titleAttr.toLowerCase().includes(cleanVisible.slice(0, Math.min(14, cleanVisible.length)).toLowerCase())
      ) {
        fullTitle = titleAttr;
      }
    }

    if (fullTitle === visibleText && isTruncated) {
      try {
        const urlObj = new URL(torrentLink.href, window.location.origin);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        let candidateFromUrl = '';

        if (parts.length >= 3 && parts[0].toLowerCase() === 'torrent') {
          candidateFromUrl = formatUrlSlug(decodeURIComponent(parts[2]));
        } else if (parts.length >= 1 && /-torrent-\d+\.html$/i.test(parts[parts.length - 1])) {
          candidateFromUrl = formatUrlSlug(decodeURIComponent(parts[parts.length - 1]));
        }

        const dlLink = cell ? cell.querySelector('a[href*="?title="]') : null;
        if (dlLink) {
          const dlUrl = new URL(dlLink.href, window.location.origin);
          const titleParam = dlUrl.searchParams.get('title');
          if (titleParam && titleParam.length > candidateFromUrl.length) {
            candidateFromUrl = formatUrlSlug(titleParam);
          }
        }

        if (candidateFromUrl && candidateFromUrl.length >= cleanVisible.length) {
          fullTitle = candidateFromUrl;
        }
      } catch {}
    }

    torrentLink.dataset.rawTitle = fullTitle;
  }

  return { titleLink: torrentLink, titleCell: cell };
}

function extractRowData(row, tableMeta = null) {
  if (row.querySelector('th') || row.classList.contains('thead') || row.classList.contains('tor-empty-trash-row')) return null;

  const isNyaa = tableMeta ? tableMeta.isNyaa : Boolean(row.closest('table.torrent-list'));
  const titleInfo = getTitleLinkAndRestoreFullText(row, isNyaa);
  if (!titleInfo) return null;

  const { titleLink, titleCell } = titleInfo;
  const rawTitle = titleLink.dataset.rawTitle;
  if (!rawTitle) return null;

  const cells = Array.from(row.querySelectorAll('td'));
  const is1337x = is1337xHost();

  const uploaderCell =
    row.querySelector('td.coll-5, td.uploader, td.vip, td.user') ||
    (is1337x && cells.length >= 6 ? cells[5] : null) ||
    (tableMeta && tableMeta.uploaderIdx >= 0 && cells[tableMeta.uploaderIdx] ? cells[tableMeta.uploaderIdx] : null);

  let uploaderTarget = null;
  let rawUploader = '';
  if (uploaderCell && uploaderCell !== titleCell) {
    uploaderTarget = uploaderCell.querySelector('a[href*="/user/"]') || uploaderCell.querySelector('a') || uploaderCell;
    if (!uploaderTarget.dataset.rawUploader) {
      uploaderTarget.dataset.rawUploader = uploaderTarget.textContent.trim();
    }
    rawUploader = uploaderTarget.dataset.rawUploader;
  }

  const isPriorityUploader =
    is1337x &&
    Boolean(rawUploader) &&
    rawUploader.toLowerCase() === PRIORITY_1337X_UPLOADER.toLowerCase();

  let sizeMB = 0;
  let sizeCell =
    row.querySelector('td.coll-4, td.size') ||
    (is1337x && cells.length >= 5 ? cells[4] : null) ||
    (tableMeta && tableMeta.sizeIdx >= 0 && cells[tableMeta.sizeIdx] ? cells[tableMeta.sizeIdx] : null);

  if (sizeCell) {
    const clone = sizeCell.cloneNode(true);
    clone.querySelectorAll('span').forEach(s => s.remove());
    const parsed = parseSizeText(clone.textContent.trim()) ?? parseSizeText(sizeCell.textContent.trim());
    if (parsed !== null) {
      sizeMB = parsed;
    } else {
      sizeCell = null;
    }
  }

  if (!sizeCell) {
    for (const td of cells) {
      if (td === titleCell) continue;
      const parsed = parseSizeText(td.textContent.trim());
      if (parsed !== null) {
        sizeMB = parsed;
        sizeCell = td;
        break;
      }
    }
  }

  if (sizeCell) {
    sizeCell.classList.add('tor-cell-size');
  }

  let seeds = -1;
  let isZeroSeed = false;
  let seedCell =
    row.querySelector('.tdseed, td.coll-2, td.seeds, td.seeders') ||
    (tableMeta && tableMeta.seedIdx >= 0 && cells[tableMeta.seedIdx] ? cells[tableMeta.seedIdx] : null) ||
    (is1337x && cells.length >= 2 ? cells[1] : null);

  let leechCell =
    row.querySelector('.tdleech, td.coll-3, td.leeches, td.leechers') ||
    (tableMeta && tableMeta.leechIdx >= 0 && cells[tableMeta.leechIdx] ? cells[tableMeta.leechIdx] : null) ||
    (is1337x && cells.length >= 3 ? cells[2] : null);

  // Fallback heuristic to detect seeders/leechers columns on generic custom trackers
  if (!seedCell) {
    const startIdx = sizeCell ? Math.max(0, cells.indexOf(sizeCell) + 1) : 0;
    const intCells = cells
      .slice(startIdx)
      .filter(td => td !== titleCell && td !== sizeCell && /^\d[\d,\s\u00a0]*$/.test(td.textContent.trim()));
    if (intCells.length > 0) {
      seedCell = intCells[0];
      if (!leechCell && intCells.length > 1) {
        leechCell = intCells[1];
      }
    }
  }

  if (seedCell) {
    seedCell.classList.add('tor-cell-seeds');
    const parsedSeeds = parseSeedsText(seedCell.textContent);
    if (parsedSeeds !== null) {
      seeds = parsedSeeds;
      isZeroSeed = parsedSeeds === 0;
    }
  }
  if (leechCell && leechCell !== seedCell) {
    leechCell.classList.add('tor-cell-leeches');
  }

  return {
    titleLink,
    titleCell,
    rawTitle,
    uploaderTarget,
    rawUploader,
    isPriorityUploader,
    sizeMB,
    seeds,
    isZeroSeed
  };
}

function highlightText(rawText, customCold, customWarm, liveQuery) {
  if (!rawText) {
    return {
      accepted: [],
      hasCustomMatch: false,
      hasLiveMatch: false,
      hasBadMatch: false,
      matchedTiers: new Set()
    };
  }

  const rules = [...STATIC_RULES];

  const coldRules = buildSafeCustomRules(customCold, 'cold-custom', { isCustom: true });
  if (coldRules.length > 0) {
    rules.unshift(...coldRules);
  }

  const parsedLive =
    typeof liveQuery === 'string'
      ? parseLiveQuery(liveQuery)
      : liveQuery || { includeTerms: [], excludeTerms: [], hasFilter: false };

  if (parsedLive.includeTerms.length > 0) {
    const terms = parsedLive.includeTerms.map(escapeRegExp).join('|');
    rules.unshift({
      category: 'cold-custom',
      isCustom: true,
      isLive: true,
      regex: new RegExp(`([a-zA-Z0-9+:_-]*(?:${terms})[a-zA-Z0-9+:_-]*)`, 'gi')
    });
  }

  const warmRules = buildSafeCustomRules(customWarm, 'warm-bad', { isBad: true });
  if (warmRules.length > 0) {
    rules.unshift(...warmRules);
  }

  const matches = [];
  rules.forEach((rule, priority) => {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = regex.exec(rawText)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: rule.category,
        isCustom: Boolean(rule.isCustom),
        isLive: Boolean(rule.isLive),
        isBad: Boolean(rule.isBad),
        isStatic: !rule.isCustom && !rule.isLive && !rule.isBad,
        priority
      });
    }
  });

  // Overlap resolution: active filters first, then longest match (allowing longer Tier 1 compounds to wrap prefix Favorites)
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.isBad !== b.isBad) return a.isBad ? -1 : 1;
    if (a.isCustom !== b.isCustom) {
      if (a.isCustom && b.isStatic && b.category === 'tier-1' && b.end > a.end) return 1;
      if (b.isCustom && a.isStatic && a.category === 'tier-1' && a.end > b.end) return -1;
      return a.isCustom ? -1 : 1;
    }
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.priority - b.priority;
  });

  const liveMatches = matches.filter(m => m.isLive);
  const customMatches = matches.filter(m => m.isCustom && !m.isLive);
  const badMatches = matches.filter(m => m.isBad);
  const staticMatches = matches.filter(m => m.isStatic);

  const accepted = [];
  let currentEnd = 0;
  let hasCustomMatch = false;
  let hasLiveMatch = liveMatches.length > 0;
  let hasBadMatch = badMatches.length > 0;
  const matchedTiers = new Set();

  for (const match of matches) {
    if (match.start >= currentEnd) {
      const item = { ...match };

      // Promote a compound tag that wraps a live query term or a Tier 1 favorite (e.g. "Dolby Atmos" for "Atmos")
      if (!item.isLive && !item.isBad && liveMatches.some(lm => lm.start >= item.start && lm.end <= item.end)) {
        item.category = 'cold-custom';
        item.isLive = true;
      } else if (
        item.isStatic &&
        item.category === 'tier-1' &&
        customMatches.some(cm => cm.start >= item.start && cm.end <= item.end)
      ) {
        item.category = 'cold-custom';
        item.isCustom = true;
        item.isStatic = false;
      }

      accepted.push(item);
      currentEnd = item.end;

      if (item.isCustom && !item.isLive) hasCustomMatch = true;
      if (item.isLive) hasLiveMatch = true;
      if (item.isBad) hasBadMatch = true;

      if (item.isBad) {
        matchedTiers.add('tier-5');
      } else if (item.isCustom && !item.isLive) {
        matchedTiers.add('cold-custom');
        staticMatches.forEach(sm => {
          if (sm.start === item.start && sm.end === item.end) {
            matchedTiers.add(sm.category);
          }
        });
      } else if (item.isStatic) {
        matchedTiers.add(item.category);
      } else if (item.isLive) {
        if (badMatches.some(bm => bm.start >= item.start && bm.end <= item.end)) {
          matchedTiers.add('tier-5');
        }
        if (customMatches.some(cm => cm.start >= item.start && cm.end <= item.end)) {
          matchedTiers.add('cold-custom');
          hasCustomMatch = true;
        }
        staticMatches.forEach(sm => {
          if (sm.start >= item.start && sm.end <= item.end) {
            matchedTiers.add(sm.category);
          }
        });
      }
    }
  }

  return { accepted, hasCustomMatch, hasLiveMatch, hasBadMatch, matchedTiers };
}

function renderHighlightedText(targetEl, rawText, accepted) {
  const frag = document.createDocumentFragment();
  let lastIdx = 0;

  for (const item of accepted) {
    if (item.start > lastIdx) {
      frag.appendChild(document.createTextNode(rawText.slice(lastIdx, item.start)));
    }
    const badge = document.createElement('span');
    badge.className = `tor-badge tor-${item.category}`;
    badge.textContent = item.text;
    frag.appendChild(badge);
    lastIdx = item.end;
  }

  if (lastIdx < rawText.length) {
    frag.appendChild(document.createTextNode(rawText.slice(lastIdx)));
  }

  targetEl.replaceChildren(frag);
}

// Strip executable tags, event handlers, and dangerous URL protocols from DOMParser-fetched rows before DOM insertion
function sanitizeImportedRow(row) {
  row.querySelectorAll('script, iframe, object, embed, style, link, meta, base, template, noscript').forEach(el => el.remove());
  const urlAttrs = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);
  const elements = [row, ...row.querySelectorAll('*')];
  elements.forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const compactVal = attr.value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        (urlAttrs.has(name) &&
          (compactVal.startsWith('javascript:') ||
            compactVal.startsWith('vbscript:') ||
            compactVal.startsWith('data:text/html')))
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
}

function getAdditionalPageUrls() {
  const urls = new Set();
  const loc = window.location.href;
  const currentUrl = new URL(loc);
  const host = currentUrl.hostname.toLowerCase();

  const pageLinks = Array.from(
    document.querySelectorAll('.pagination a, .search-page a, .pager a')
  ).filter(a => {
    const href = a.getAttribute('href') || '';
    return href && !href.startsWith('#') && !href.startsWith('javascript:');
  });

  const pageNumbers = pageLinks
    .map(a => parseInt(a.textContent.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1);

  const maxDetectedPage = pageNumbers.length > 0
    ? Math.min(PAGES_TO_FETCH, Math.max(...pageNumbers))
    : 1;

  pageLinks.forEach(a => {
    const num = parseInt(a.textContent.trim(), 10);
    if (num >= 2 && num <= PAGES_TO_FETCH && a.href) {
      try {
        const linkUrl = new URL(a.href, currentUrl.origin);
        if (linkUrl.origin === currentUrl.origin) {
          urls.add(linkUrl.href);
        }
      } catch {}
    }
  });

  if (is1337xHost(host)) {
    const q = currentUrl.searchParams.get('q');
    const currentPage = parseInt(currentUrl.searchParams.get('page') || '1', 10) || 1;
    const limit = pageNumbers.length > 0 ? maxDetectedPage : PAGES_TO_FETCH;
    if (q) {
      for (let i = 1; i <= limit; i++) {
        if (i === currentPage) continue;
        const nextUrl = new URL(loc);
        nextUrl.searchParams.set('page', String(i));
        urls.add(nextUrl.href);
      }
    }
  } else if (host.includes('limetorrents')) {
    const base = loc.split('?')[0].replace(/\/\d+\/?$/, '').replace(/\/$/, '');
    const limit = pageNumbers.length > 0 ? maxDetectedPage : PAGES_TO_FETCH;
    for (let i = 2; i <= limit; i++) {
      urls.add(`${base}/${i}/`);
    }
  } else if (host.includes('nyaa.si')) {
    const hasNext = Boolean(
      document.querySelector('.pagination a[rel="next"], .pagination li.next:not(.disabled) a')
    );
    const limit = pageNumbers.length > 0 ? maxDetectedPage : (hasNext ? PAGES_TO_FETCH : 1);
    for (let i = 2; i <= limit; i++) {
      const nextUrl = new URL(loc);
      nextUrl.searchParams.set('p', String(i));
      urls.add(nextUrl.href);
    }
  }

  urls.delete(loc);
  return Array.from(urls);
}

async function mergeAdditionalPages(mainTable, tableMeta, onProgress, onPageMerged) {
  const nextUrls = getAdditionalPageUrls();
  if (nextUrls.length === 0) return 0;

  const tbody = mainTable.querySelector('tbody') || mainTable;
  const seenKeys = new Set();

  Array.from(tbody.querySelectorAll('tr')).forEach(row => {
    const data = extractRowData(row, tableMeta);
    if (data) seenKeys.add(`${data.rawTitle}|${data.rawUploader}`);
  });

  const total = nextUrls.length;
  let completed = 0;
  if (onProgress) onProgress(0, total);

  const fetchPromises = nextUrls.map(async (url) => {
    let addedAny = false;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return;
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const table = findTorrentTable(doc);
      if (!table) return;
      const fetchedBody = table.querySelector('tbody') || table;
      Array.from(fetchedBody.querySelectorAll('tr')).forEach(row => {
        const importedRow = document.importNode(row, true);
        sanitizeImportedRow(importedRow);
        const data = extractRowData(importedRow, tableMeta);
        if (data) {
          const key = `${data.rawTitle}|${data.rawUploader}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            tbody.appendChild(importedRow);
            addedAny = true;
          }
        }
      });
    } catch {
      return;
    } finally {
      completed++;
      if (addedAny && onPageMerged) onPageMerged();
      if (onProgress) onProgress(completed, total);
    }
  });

  await Promise.all(fetchPromises);
  return total;
}

function getTableColumnCount(mainTable, sampleRow = null) {
  const refRow =
    mainTable.querySelector('thead tr') ||
    sampleRow ||
    mainTable.querySelector('tr');
  if (!refRow) return 1;
  const cells = Array.from(refRow.children).filter(el => el.tagName === 'TH' || el.tagName === 'TD');
  const total = cells.reduce((sum, cell) => sum + (parseInt(cell.colSpan, 10) || 1), 0);
  return Math.max(1, total);
}

function createEmptyTrashRow(colSpan, totalCount, hiddenByTrashCount, onReveal) {
  const tr = document.createElement('tr');
  tr.className = 'tor-empty-trash-row';

  const td = document.createElement('td');
  td.colSpan = colSpan;
  td.className = 'tor-empty-trash-cell';
  td.setAttribute('role', 'button');
  td.tabIndex = 0;

  const inner = document.createElement('span');
  inner.className = 'tor-empty-trash-inner';
  inner.appendChild(createSvgIcon('trash'));

  const isSingle = hiddenByTrashCount === 1;
  const prefixText =
    hiddenByTrashCount === totalCount
      ? (totalCount === 1 ? '1 release is hidden by' : `All ${totalCount} releases are hidden by`)
      : `${hiddenByTrashCount} matching ${isSingle ? 'release is' : 'releases are'} hidden by`;

  const accent = document.createElement('span');
  accent.className = 'tor-empty-trash-accent';
  accent.textContent = 'Hide unwanted';

  const kbd = document.createElement('kbd');
  kbd.className = 'tor-empty-trash-kbd';
  kbd.textContent = 'H';

  inner.append(
    document.createTextNode(`${prefixText} `),
    accent,
    document.createTextNode(' - Click here or press '),
    kbd,
    document.createTextNode(` to show ${isSingle ? 'it' : 'them'}.`)
  );

  td.appendChild(inner);
  tr.appendChild(td);

  if (typeof onReveal === 'function') {
    const handleReveal = (e) => {
      e.preventDefault();
      e.stopPropagation();
      onReveal();
    };
    tr.addEventListener('click', handleReveal);
    td.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleReveal(e);
      }
    });
  }

  return tr;
}

function processTable(mainTable, tableMeta, customCold, customWarm, state, onRevealTrash = null) {
  const { liveFilter, sortByWeight, sortBySeeds, selectedTiers, hideTrash } = state;
  const effectiveHideTrash = Boolean(hideTrash);
  mainTable.classList.toggle('tor-hide-trash', effectiveHideTrash);

  const tbody = mainTable.querySelector('tbody') || mainTable;
  tbody.querySelectorAll('tr.tor-empty-trash-row').forEach(el => el.remove());

  const allRows = Array.from(tbody.querySelectorAll('tr'));
  const dataRows = [];
  const parsedQuery = parseLiveQuery(liveFilter);
  const hasTierFilter = selectedTiers.size > 0;
  const hasTextFilter = parsedQuery.hasFilter;
  let trashCount = 0;
  let visibleCount = 0;
  let hiddenByTrashCount = 0;

  allRows.forEach((row, idx) => {
    if (row.dataset.origIndex === undefined) {
      row.dataset.origIndex = idx;
    }

    const info = extractRowData(row, tableMeta);
    if (!info) return;

    const {
      titleLink,
      titleCell,
      rawTitle,
      uploaderTarget,
      rawUploader,
      isPriorityUploader,
      sizeMB,
      seeds,
      isZeroSeed
    } = info;
    const rowTextLower = `${rawTitle} ${rawUploader}`.toLowerCase();

    const matchesText =
      !hasTextFilter ||
      (parsedQuery.includeTerms.every(term => rowTextLower.includes(term)) &&
        parsedQuery.excludeTerms.every(term => !rowTextLower.includes(term)));

    const activeLiveForHighlight = matchesText ? parsedQuery : null;
    const titleRes = highlightText(rawTitle, customCold, customWarm, activeLiveForHighlight);
    renderHighlightedText(titleLink, rawTitle, titleRes.accepted);
    updateRowSubtitleButton(titleCell, titleLink, rawTitle, state.subtitleSettings, state.subtitleProviders);

    let uploaderRes = {
      accepted: [],
      hasCustomMatch: false,
      hasLiveMatch: false,
      hasBadMatch: false,
      matchedTiers: new Set()
    };
    if (uploaderTarget && rawUploader) {
      uploaderRes = highlightText(rawUploader, customCold, customWarm, activeLiveForHighlight);
      renderHighlightedText(uploaderTarget, rawUploader, uploaderRes.accepted);
    }

    const rowTiers = new Set([...titleRes.matchedTiers, ...uploaderRes.matchedTiers]);
    const isLiveHit =
      parsedQuery.includeTerms.length > 0 &&
      matchesText &&
      (titleRes.hasLiveMatch || uploaderRes.hasLiveMatch);
    const isCustomHit = titleRes.hasCustomMatch || uploaderRes.hasCustomMatch;
    const isTrash = isZeroSeed || titleRes.hasBadMatch || uploaderRes.hasBadMatch;

    if (isTrash) trashCount++;

    row.classList.remove('tor-row-trash', 'tor-row-priority', 'tor-row-match', 'tor-row-live', 'tor-row-filtered');
    if (isTrash) {
      row.classList.add('tor-row-trash');
    } else if (isPriorityUploader) {
      row.classList.add('tor-row-priority');
    } else if (isLiveHit) {
      row.classList.add('tor-row-live');
    } else if (isCustomHit) {
      row.classList.add('tor-row-match');
    }

    let matchesTier = true;
    if (hasTierFilter) {
      matchesTier = Array.from(selectedTiers).some(tier => rowTiers.has(tier));
    }
    const isFilteredOut = !matchesTier || !matchesText;

    if (isFilteredOut) {
      row.classList.add('tor-row-filtered');
    } else if (effectiveHideTrash && isTrash) {
      hiddenByTrashCount++;
    } else {
      visibleCount++;
    }

    dataRows.push({
      row,
      sizeMB,
      seeds,
      isTrash,
      isPriorityUploader,
      isLiveHit,
      origIndex: parseInt(row.dataset.origIndex, 10)
    });
  });

  dataRows.sort((a, b) => {
    if (a.isTrash !== b.isTrash) return a.isTrash ? 1 : -1;
    if (a.isPriorityUploader !== b.isPriorityUploader) return a.isPriorityUploader ? -1 : 1;
    if (a.isLiveHit !== b.isLiveHit) return a.isLiveHit ? -1 : 1;

    if (sortBySeeds) {
      if (b.seeds !== a.seeds) return b.seeds - a.seeds;
      if (b.sizeMB !== a.sizeMB) return b.sizeMB - a.sizeMB;
      return a.origIndex - b.origIndex;
    }
    if (sortByWeight) {
      if (b.sizeMB !== a.sizeMB) return b.sizeMB - a.sizeMB;
      return a.origIndex - b.origIndex;
    }
    return a.origIndex - b.origIndex;
  });

  dataRows.forEach(item => tbody.appendChild(item.row));

  if (effectiveHideTrash && dataRows.length > 0 && visibleCount === 0 && hiddenByTrashCount > 0) {
    const colSpan = getTableColumnCount(mainTable, dataRows[0].row);
    tbody.appendChild(
      createEmptyTrashRow(colSpan, dataRows.length, hiddenByTrashCount, onRevealTrash)
    );
  }

  const countBadge = document.getElementById('tor-meta-count');
  if (countBadge && !state.isMerging) {
    if (hasTierFilter || hasTextFilter) {
      countBadge.textContent = `${visibleCount} / ${dataRows.length} releases`;
    } else {
      countBadge.textContent = `${dataRows.length} releases (${trashCount} filtered)`;
    }
  }
}

function buildControlBar(state) {
  const bar = document.createElement('div');
  bar.id = 'tor-control-bar';

  const makeActionButton = (id, iconName, labelText, isActive) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = isActive ? 'tor-sort-btn active' : 'tor-sort-btn';
    const iconSvg = createSvgIcon(iconName);
    if (iconName === 'seeds') {
      for (let i = 1; i <= 6; i++) {
        const line = document.createElement('span');
        line.className = `th-speed-line th-speed-line-${i}`;
        line.setAttribute('aria-hidden', 'true');
        btn.appendChild(line);
      }
      const wrap = document.createElement('span');
      wrap.className = 'th-seeder-arrow-wrap';
      wrap.appendChild(iconSvg);
      btn.appendChild(wrap);
    } else {
      btn.appendChild(iconSvg);
    }
    const span = document.createElement('span');
    span.textContent = labelText;
    btn.appendChild(span);
    return btn;
  };

  const row1 = document.createElement('div');
  row1.className = 'tor-bar-row';
  const darkBtn = makeActionButton('tor-dark-btn', 'dark', 'Dark Mode', state.darkMode);
  const weightBtn = makeActionButton('tor-weight-btn', 'weight', 'Sort by Size', state.sortByWeight);
  const seedsBtn = makeActionButton('tor-seeds-btn', 'seeds', 'Sort by Seeders', state.sortBySeeds);
  const trashBtn = makeActionButton('tor-trash-btn', 'trash', 'Hide unwanted', state.hideTrash);
  const countBadge = document.createElement('span');
  countBadge.id = 'tor-meta-count';
  countBadge.className = 'tor-meta-count';
  countBadge.textContent = 'Loading...';
  row1.append(darkBtn, weightBtn, seedsBtn, trashBtn, countBadge);

  const row2 = document.createElement('div');
  row2.className = 'tor-bar-row';
  const legendEl = document.createElement('div');
  legendEl.id = 'tor-legend';
  legendEl.className = 'tor-legend';

  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  favBtn.className = 'tor-badge tor-legend-btn tor-cold-custom';
  favBtn.dataset.tier = 'cold-custom';
  favBtn.appendChild(createSvgIcon('star'));
  const favLabel = document.createElement('span');
  favLabel.textContent = 'Favorite';
  favBtn.appendChild(favLabel);
  legendEl.appendChild(favBtn);

  const tierDefs = [
    ['tier-1', '1. Lossless/4K'],
    ['tier-2', '2. Very Good'],
    ['tier-3', '3. Standard'],
    ['tier-4', '4. Poor'],
    ['tier-5', '5. Avoid']
  ];
  const legendBtns = [favBtn];
  tierDefs.forEach(([tier, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tor-badge tor-legend-btn tor-${tier}`;
    btn.dataset.tier = tier;
    btn.textContent = label;
    legendEl.appendChild(btn);
    legendBtns.push(btn);
  });

  const legendResetBtn = document.createElement('button');
  legendResetBtn.type = 'button';
  legendResetBtn.id = 'tor-legend-reset';
  legendResetBtn.className = 'tor-legend-reset';
  legendResetBtn.title = 'Reset selected tiers';
  legendResetBtn.hidden = true;
  legendResetBtn.appendChild(createSvgIcon('close'));
  legendEl.appendChild(legendResetBtn);
  row2.appendChild(legendEl);

  const row3 = document.createElement('div');
  row3.className = 'tor-bar-row';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'tor-search-wrap';

  const beamClip = document.createElement('span');
  beamClip.className = 'tor-search-beam-clip';
  beamClip.setAttribute('aria-hidden', 'true');
  const scanBeam = document.createElement('span');
  scanBeam.className = 'tor-search-scan-beam';
  beamClip.appendChild(scanBeam);
  searchWrap.appendChild(beamClip);

  searchWrap.appendChild(createSvgIcon('search'));

  const liveInput = document.createElement('input');
  liveInput.type = 'text';
  liveInput.id = 'tor-live-search';
  liveInput.className = 'tor-live-input';
  liveInput.maxLength = 120;
  liveInput.placeholder = 'Filter (press / - e.g. Atmos, HDR)';
  searchWrap.appendChild(liveInput);

  const liveClearBtn = document.createElement('button');
  liveClearBtn.type = 'button';
  liveClearBtn.id = 'tor-live-clear';
  liveClearBtn.className = 'tor-live-clear';
  liveClearBtn.title = 'Clear filter';
  liveClearBtn.hidden = true;
  liveClearBtn.appendChild(createSvgIcon('close'));
  searchWrap.appendChild(liveClearBtn);
  row3.appendChild(searchWrap);

  bar.append(row1, row2, row3);
  return {
    bar,
    countBadge,
    darkBtn,
    weightBtn,
    seedsBtn,
    trashBtn,
    legendEl,
    legendBtns,
    legendResetBtn,
    searchWrap,
    liveInput,
    liveClearBtn
  };
}

async function initHighlighter() {
  if (maybeRedirect1337xSortBySize()) return;
  if (globalThis.__torHighlighterInitialized || document.getElementById('tor-control-bar')) return;

  const mainTable = findTorrentTable(document);
  if (!mainTable) return;

  globalThis.__torHighlighterInitialized = true;
  injectStyles();
  mainTable.classList.add('tor-enhanced');
  const tableMeta = detectTableColumns(mainTable);

  const storage = await extApi.storage.local.get([
    'customColdTags',
    'customWarmTags',
    'defaultsInitialized',
    'prefDarkMode',
    'prefHideTrash',
    'prefSortByWeight',
    'prefSortBySeeds',
    'subtitleSettings',
    'subtitleProviders'
  ]);

  let customCold = storage.defaultsInitialized && storage.customColdTags ? storage.customColdTags : [...DEFAULT_COLD];
  let customWarm = storage.defaultsInitialized && storage.customWarmTags ? storage.customWarmTags : [...DEFAULT_WARM];

  const initSortBySeeds = Boolean(storage.prefSortBySeeds);
  const initSortByWeight = initSortBySeeds ? false : (storage.prefSortByWeight ?? true);
  const initialSubtitleProviders = resolveSubtitleProviders(storage.subtitleProviders, storage.subtitleSettings);

  const state = {
    sortByWeight: initSortByWeight,
    sortBySeeds: initSortBySeeds,
    darkMode: storage.prefDarkMode ?? true,
    hideTrash: storage.prefHideTrash ?? DEFAULT_HIDE_TRASH,
    subtitleProviders: initialSubtitleProviders,
    subtitleSettings: resolveSubtitleSettings(storage.subtitleSettings),
    liveFilter: '',
    selectedTiers: new Set(),
    isMerging: false
  };

  mainTable.classList.toggle('tor-dark-table', state.darkMode);
  mainTable.classList.toggle('tor-hide-trash', state.hideTrash);

  const {
    bar,
    countBadge,
    darkBtn,
    weightBtn,
    seedsBtn,
    trashBtn,
    legendEl,
    legendBtns,
    legendResetBtn,
    searchWrap,
    liveInput,
    liveClearBtn
  } = buildControlBar(state);
  mainTable.parentNode.insertBefore(bar, mainTable);

  const darkIconEl = darkBtn.querySelector('.tor-icon-dark');
  const trashIconEl = trashBtn.querySelector('.tor-icon-trash');

  const revealTrash = () => {
    if (!state.hideTrash) return;
    state.hideTrash = false;
    trashBtn.classList.remove('active');
    triggerClickFeedback(trashBtn);
    triggerElementAnim(trashIconEl, 'tor-anim-stamp', 500);
    extApi.storage.local.set({ prefHideTrash: false });
    refresh();
  };

  const refresh = () => processTable(mainTable, tableMeta, customCold, customWarm, state, revealTrash);

  const syncSortUI = () => {
    weightBtn.classList.toggle('active', state.sortByWeight);
    seedsBtn.classList.toggle('active', state.sortBySeeds);
  };

  const syncLegendUI = () => {
    const hasFilter = state.selectedTiers.size > 0;
    legendEl.classList.toggle('has-filter', hasFilter);
    legendResetBtn.hidden = !hasFilter;
    legendBtns.forEach(btn => {
      btn.classList.toggle('selected', state.selectedTiers.has(btn.dataset.tier));
    });
  };

  const toggleWeight = () => {
    state.sortByWeight = !state.sortByWeight;
    if (state.sortByWeight) state.sortBySeeds = false;
    syncSortUI();
    triggerClickFeedback(weightBtn);
    triggerElementAnim(weightBtn, 'tor-anim-sort', 460, '.tor-weight-bar-3');
    extApi.storage.local.set({
      prefSortByWeight: state.sortByWeight,
      prefSortBySeeds: state.sortBySeeds
    });
    refresh();
  };

  const toggleSeeds = () => {
    state.sortBySeeds = !state.sortBySeeds;
    if (state.sortBySeeds) state.sortByWeight = false;
    syncSortUI();
    triggerClickFeedback(seedsBtn);
    triggerElementAnim(seedsBtn, 'tor-anim-elevator', 600, '.tor-icon-seeds');
    extApi.storage.local.set({
      prefSortByWeight: state.sortByWeight,
      prefSortBySeeds: state.sortBySeeds
    });
    refresh();
  };

  const toggleTrash = () => {
    state.hideTrash = !state.hideTrash;
    trashBtn.classList.toggle('active', state.hideTrash);
    triggerClickFeedback(trashBtn);
    triggerElementAnim(trashIconEl, 'tor-anim-stamp', 500);
    extApi.storage.local.set({ prefHideTrash: state.hideTrash });
    refresh();
  };

  const toggleTier = (tier) => {
    const willSelect = !state.selectedTiers.has(tier);
    if (willSelect) {
      state.selectedTiers.add(tier);
      if (tier === 'tier-5' && state.hideTrash) {
        state.hideTrash = false;
        trashBtn.classList.remove('active');
        triggerElementAnim(trashIconEl, 'tor-anim-stamp', 500);
        extApi.storage.local.set({ prefHideTrash: false });
      }
    } else {
      state.selectedTiers.delete(tier);
    }
    const targetBtn = legendBtns.find(btn => btn.dataset.tier === tier);
    if (targetBtn) {
      triggerClickFeedback(targetBtn);
      if (tier === 'cold-custom') {
        triggerElementAnim(targetBtn, 'tor-anim-fav', 460, '.tor-star-icon');
      }
    }
    syncLegendUI();
    refresh();
  };

  weightBtn.addEventListener('click', toggleWeight);
  seedsBtn.addEventListener('click', toggleSeeds);

  darkBtn.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    mainTable.classList.toggle('tor-dark-table', state.darkMode);
    darkBtn.classList.toggle('active', state.darkMode);
    triggerClickFeedback(darkBtn);
    triggerElementAnim(darkIconEl, 'tor-anim-dark', 540);
    extApi.storage.local.set({ prefDarkMode: state.darkMode });
  });

  trashBtn.addEventListener('click', toggleTrash);

  legendBtns.forEach(btn => {
    btn.addEventListener('click', () => toggleTier(btn.dataset.tier));
  });

  legendResetBtn.addEventListener('click', () => {
    state.selectedTiers.clear();
    triggerClickFeedback(legendResetBtn);
    syncLegendUI();
    refresh();
  });

  liveInput.addEventListener('focus', () => {
    triggerElementAnim(searchWrap, 'tor-is-scanning', 850, '.tor-search-scan-beam');
  });

  liveInput.addEventListener('input', (e) => {
    state.liveFilter = e.target.value;
    liveClearBtn.hidden = state.liveFilter.length === 0;
    refresh();
  });

  liveClearBtn.addEventListener('click', () => {
    state.liveFilter = '';
    liveInput.value = '';
    liveClearBtn.hidden = true;
    liveInput.focus();
    refresh();
  });

  liveInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (liveInput.value.length > 0) {
        state.liveFilter = '';
        liveInput.value = '';
        liveClearBtn.hidden = true;
        refresh();
      }
      liveInput.blur();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (
      document.activeElement === liveInput ||
      isEditableElement(document.activeElement) ||
      isEditableElement(e.target)
    ) {
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      liveInput.focus();
      return;
    }

    const digitMatch =
      /^[1-5]$/.test(e.key)
        ? e.key
        : /^Digit([1-5])$/.test(e.code || '')
          ? e.code.slice(5)
          : null;

    if (digitMatch) {
      e.preventDefault();
      toggleTier(`tier-${digitMatch}`);
      return;
    }

    const keyLower = e.key.toLowerCase();
    if (keyLower === 'f') {
      e.preventDefault();
      toggleTier('cold-custom');
    } else if (keyLower === 'p') {
      e.preventDefault();
      toggleWeight();
    } else if (keyLower === 's') {
      e.preventDefault();
      toggleSeeds();
    } else if (keyLower === 'h') {
      e.preventDefault();
      toggleTrash();
    }
  });

  extApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    let shouldRefresh = false;
    if (changes.customColdTags) {
      customCold = changes.customColdTags.newValue || [];
      shouldRefresh = true;
    }
    if (changes.customWarmTags) {
      customWarm = changes.customWarmTags.newValue || [];
      shouldRefresh = true;
    }
    if (changes.prefHideTrash && typeof changes.prefHideTrash.newValue === 'boolean') {
      if (changes.prefHideTrash.newValue !== state.hideTrash) {
        state.hideTrash = changes.prefHideTrash.newValue;
        trashBtn.classList.toggle('active', state.hideTrash);
        shouldRefresh = true;
      }
    }
    if (changes.subtitleProviders || changes.subtitleSettings) {
      if (changes.subtitleSettings) {
        state.subtitleSettings = resolveSubtitleSettings(changes.subtitleSettings.newValue);
      }
      if (changes.subtitleProviders) {
        state.subtitleProviders = resolveSubtitleProviders(
          changes.subtitleProviders.newValue,
          changes.subtitleSettings ? changes.subtitleSettings.newValue : state.subtitleSettings
        );
      }
      mainTable.querySelectorAll('.tor-title-cell').forEach(cell => {
        if (cell.dataset.subRawTitle) {
          const link = cell.querySelector('a.tor-title-link');
          updateRowSubtitleButton(
            cell,
            link,
            cell.dataset.subRawTitle,
            state.subtitleSettings,
            state.subtitleProviders
          );
        }
      });
    }
    if (shouldRefresh) refresh();
  });

  refresh();

  state.isMerging = true;
  const mergedPageCount = await mergeAdditionalPages(
    mainTable,
    tableMeta,
    (done, total) => {
      if (countBadge) {
        countBadge.classList.add('tor-is-merging');
        countBadge.textContent = `Merging ${done}/${total}...`;
      }
    },
    () => refresh()
  );
  state.isMerging = false;
  if (countBadge) {
    countBadge.classList.remove('tor-is-merging');
    if (mergedPageCount > 0) {
      triggerElementAnim(countBadge, 'tor-merge-done', 520);
    }
  }
  refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHighlighter);
} else {
  initHighlighter();
}
