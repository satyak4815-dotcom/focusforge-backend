const express = require('express');
const router = express.Router();
const User = require('../models/User');

const verifyToken = require('../middleware/auth');

const VISIT_FIELD_KEYS = [
  'url',
  'domain',
  'accessTime',
  'accesstime',
  'accessedAt',
  'timestamp',
  'visitCount',
  'visitcount',
  'isBlocked',
  'visitType',
];

function pickVisitFields(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const k of VISIT_FIELD_KEYS) {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  }
  return out;
}

/** Later sources override earlier keys (top-level → website → visitedWebsite). */
function mergeVisitPayload(body) {
  let merged = {};
  merged = { ...merged, ...pickVisitFields(body || {}) };
  merged = { ...merged, ...pickVisitFields(body?.website) };
  merged = { ...merged, ...pickVisitFields(body?.visitedWebsite) };
  return merged;
}

function stripWww(host) {
  if (!host || typeof host !== 'string') return '';
  return host.replace(/^www\./i, '').toLowerCase();
}

function deriveDomainFromUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const s = urlStr.trim();
  try {
    if (/^https?:\/\//i.test(s)) {
      return stripWww(new URL(s).hostname);
    }
  } catch (_) {
    /* fall through */
  }
  const first = s.split('/')[0];
  return stripWww(first);
}

function normalizeDomainKey(d) {
  if (!d || typeof d !== 'string') return '';
  return stripWww(d.split('/')[0]);
}

/** Host + path + search (no scheme), lowercase host without www. */
function canonicalUrlKey(u) {
  if (!u || typeof u !== 'string') return '';
  const t = u.trim();
  try {
    if (/^https?:\/\//i.test(t)) {
      const { hostname, pathname, search } = new URL(t);
      const host = stripWww(hostname);
      const path = pathname || '/';
      return `${host}${path}${search}`;
    }
  } catch (_) {
    /* fall through */
  }
  return t.toLowerCase();
}

function resolveAccessDate(merged) {
  const raw =
    merged.accessTime ??
    merged.accesstime ??
    merged.accessedAt ??
    merged.timestamp;
  if (raw === undefined || raw === null || raw === '') {
    return new Date();
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function parseVisitCount(merged) {
  const raw = merged.visitCount ?? merged.visitcount;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function parseIsBlocked(merged) {
  const v = merged.isBlocked;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  return false;
}

function resolveVisitType(merged, isBlocked) {
  let vt = merged.visitType;
  if (typeof vt === 'string' && vt.trim()) return vt.trim();
  return isBlocked ? 'blocked' : 'normal';
}

function getEntryUrl(entry) {
  if (typeof entry === 'string') return entry;
  return entry && entry.url != null ? String(entry.url) : '';
}

function getEntryDomain(entry) {
  if (typeof entry === 'string') {
    return normalizeDomainKey(deriveDomainFromUrl(entry) || entry);
  }
  if (entry && entry.domain) return normalizeDomainKey(String(entry.domain));
  return normalizeDomainKey(deriveDomainFromUrl(getEntryUrl(entry)));
}

function visitMatchesIncoming(entry, incomingUrl, incomingDomainKey) {
  const iu = canonicalUrlKey(incomingUrl);
  const idk = incomingDomainKey;
  const entryUrl = getEntryUrl(entry);
  const eu = canonicalUrlKey(entryUrl);
  const ed = getEntryDomain(entry);
  if (iu && eu && iu === eu) return true;
  if (idk && ed && idk === ed) return true;
  return false;
}

function normalizeVisitFromBody(body) {
  const merged = mergeVisitPayload(body);
  let url = merged.url != null ? String(merged.url).trim() : '';
  let domain = merged.domain != null ? String(merged.domain).trim() : '';

  if (url && !domain) {
    domain = deriveDomainFromUrl(url);
  }
  if (!url && domain) {
    url = /^https?:\/\//i.test(domain) ? domain : `https://${stripWww(domain.split('/')[0])}/`;
  }

  const accessDate = resolveAccessDate(merged);
  const addCount = parseVisitCount(merged);
  const isBlocked = parseIsBlocked(merged);
  const visitType = resolveVisitType(merged, isBlocked);
  const domainKey = normalizeDomainKey(domain || deriveDomainFromUrl(url));

  return { url, domain, domainKey, accessDate, addCount, isBlocked, visitType };
}

async function recordVisitedWebsite(req, res, next) {
  try {
    const { url, domain, domainKey, accessDate, addCount, isBlocked, visitType } = normalizeVisitFromBody(
      req.body || {}
    );

    if (!url && !domainKey) {
      return res.status(400).json({ message: 'url or domain is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!Array.isArray(user.visitedWebsites)) {
      user.visitedWebsites = [];
    }

    const incomingUrl = url || (domainKey ? `https://${domainKey}/` : '');

    let idx = user.visitedWebsites.findIndex((entry) =>
      visitMatchesIncoming(entry, incomingUrl, domainKey)
    );

    if (idx === -1) {
      user.visitedWebsites.push({
        url: incomingUrl,
        domain: domain || domainKey || deriveDomainFromUrl(incomingUrl),
        visitCount: addCount,
        accessTimes: [accessDate],
        isBlocked,
        visitType,
      });
    } else {
      const prev = user.visitedWebsites[idx];
      if (typeof prev === 'string') {
        user.visitedWebsites[idx] = {
          url: incomingUrl,
          domain: domain || domainKey || deriveDomainFromUrl(incomingUrl),
          visitCount: addCount,
          accessTimes: [accessDate],
          isBlocked,
          visitType,
        };
      } else {
        prev.visitCount = (prev.visitCount || 0) + addCount;
        if (!Array.isArray(prev.accessTimes)) prev.accessTimes = [];
        prev.accessTimes.push(accessDate);
        prev.url = incomingUrl;
        if (domain || domainKey) prev.domain = domain || domainKey || prev.domain;
        prev.isBlocked = isBlocked;
        prev.visitType = visitType;
      }
    }

    await user.save();
    res.status(200).json({ ok: true, success: true });
  } catch (error) {
    next(error);
  }
}

// POST /add-xp
// Expects { xpDelta: <positive integer> } — always send a strict 1-unit delta per minute tick.
// The `xp` key is accepted as a fallback for backward compatibility.
// The backend uses MongoDB's $inc operator so this endpoint is safe to call repeatedly;
// sending cumulative totals instead of deltas WILL cause exponential XP inflation.
router.post('/add-xp', verifyToken, async (req, res, next) => {
  try {
    // Accept xpDelta (new canonical key) or xp (legacy fallback)
    const raw = req.body.xpDelta ?? req.body.xp;
    const xpToAdd = parseInt(raw, 10);

    if (!xpToAdd || xpToAdd <= 0) {
      return res.status(400).json({
        message: 'xpDelta must be a positive integer (e.g. { xpDelta: 1 }). ' +
                 'Send a per-tick delta, never a cumulative total.'
      });
    }

    // Single atomic operation: increment XP and focus minutes together.
    // This prevents the double-award bug where session /end also added XP.
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $inc: {
          focusXP: xpToAdd,
          totalFocusMinutes: xpToAdd  // 1 XP == 1 minute, so delta doubles as minute count
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentXP = user.focusXP;
    const newLevel = Math.floor(currentXP / 100) + 1;

    // Update level if it changed — requires a second write but only happens on level-up
    if (user.level !== newLevel) {
      user.level = newLevel;
      await user.save();
    }

    const xpToNextLevel = 100 - (currentXP % 100);

    res.json({
      message: 'XP added successfully',
      currentXP,
      level: newLevel,
      xpToNextLevel
    });
  } catch (error) {
    next(error);
  }
});

// POST /deduct-xp
router.post('/deduct-xp', verifyToken, async (req, res, next) => {
  try {
    const xpToDeduct = req.body.xp && req.body.xp > 0 ? req.body.xp : 0;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let newXP = user.focusXP - xpToDeduct;
    if (newXP < 0) newXP = 0;

    user.focusXP = newXP;
    user.updateLevel();
    await user.save();

    // New endpoint, use standard success format
    res.json({
      success: true,
      data: {
        focusXP: user.focusXP,
        level: user.level
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /profile
router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      username: user.username,
      email: user.email,
      focusXP: user.focusXP,
      focusCoins: user.focusCoins,
      totalFocusMinutes: user.totalFocusMinutes,
      distractionsBlocked: user.distractionsBlocked,
      blockedApps: user.blockedApps,
      blockedSites: user.blockedSites || []
    });
  } catch (error) {
    next(error);
  }
});

// GET /stats
router.get('/stats', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      focusXP: user.focusXP,
      focusCoins: user.focusCoins,
      totalFocusMinutes: user.totalFocusMinutes,
      distractionsBlocked: user.distractionsBlocked
    });
  } catch (error) {
    next(error);
  }
});

async function listVisitedWebsites(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('visitedWebsites');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.visitedWebsites || []);
  } catch (error) {
    next(error);
  }
}

// GET /visited-websites & /visitedWebsites — list current user's visit history
router.get(['/visited-websites', '/visitedWebsites'], verifyToken, listVisitedWebsites);

// POST /visited-websites & /visitedWebsites — Focus Guard extension visit sync (same handler)
router.post('/visited-websites', verifyToken, recordVisitedWebsite);
router.post('/visitedWebsites', verifyToken, recordVisitedWebsite);

// GET /all-users
// Fetches all users from the User collection (password excluded).
// Auth intentionally disabled for temporary testing.
router.get('/all-users', async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ _id: -1 });

    res.json({
      total: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
