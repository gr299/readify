import bcrypt from 'bcryptjs';
import { db, setSetting, USE_SUPABASE } from './db.js';
import { avatarDataUri, sanitizeContent } from './utils.js';
import { setArticleTags } from './routes/articles.js';

// Helper to handle both sync (SQLite) and async (Supabase) database calls
async function dbGet(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.get(...params);
  }
  return db.prepare(query).get(...params);
}

async function dbRun(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.run(...params);
  }
  return db.prepare(query).run(...params);
}

async function dbAll(query, ...params) {
  if (USE_SUPABASE) {
    const stmt = db.prepare(query);
    return await stmt.all(...params);
  }
  return db.prepare(query).all(...params);
}

async function dbExec(query) {
  if (USE_SUPABASE) {
    return await db.exec(query);
  }
  return db.exec(query);
}

const CATEGORIES = [
  'Technology', 'Design', 'Business', 'Health', 'Science',
  'Lifestyle', 'Education', 'Travel', 'Food', 'Finance',
];

const TAG_SETS = {
  Technology: ['javascript', 'web-development', 'ai', 'opensource'],
  Design: ['ui', 'ux', 'typography', 'color'],
  Business: ['startup', 'strategy', 'remote-work'],
  Health: ['fitness', 'wellness', 'nutrition'],
  Science: ['space', 'physics', 'research'],
  Lifestyle: ['productivity', 'habits', 'minimalism'],
  Education: ['learning', 'study-tips', 'teaching'],
  Travel: ['adventure', 'budget-travel', 'itinerary'],
  Food: ['recipes', 'cooking', 'meal-prep'],
  Finance: ['investing', 'saving', 'crypto'],
};

const ARTICLES = [
  {
    title: 'How Static Site Generators Changed Web Development',
    summary: 'A look at how static site generators made the modern web faster, simpler, and more secure — and where they still fall short.',
    content: `<p>Static site generators quietly transformed how we build for the web. Instead of rendering pages on a server for every request, developers now compile entire sites ahead of time into plain HTML, CSS, and JavaScript.</p><h2>Why speed matters</h2><p>The biggest win is performance. A pre-rendered page can be served from a CDN edge node anywhere in the world in milliseconds, with no database round-trips and no dynamic assembly.</p><blockquote>Fast pages aren't just nice to have. Every extra second of load time measurably reduces engagement and trust.</blockquote><h2>The trade-offs</h2><ul><li>Content that changes constantly becomes awkward to publish.</li><li>Personalization requires JavaScript on the client.</li><li>Build times grow as sites scale.</li></ul><p>For most content-driven projects the trade-offs are well worth it.</p>`,
    category: 'Technology',
    status: 'published',
    views: 1240,
  },
  {
    title: 'Designing With Color: A Practical Guide',
    summary: 'Learn how to build a cohesive color system that stays accessible and looks intentional across every screen.',
    content: `<p>Color is often the first thing people notice about a product, and the easiest to get wrong. A disciplined approach starts with roles, not preferences.</p><h2>Start with a semantic palette</h2><p>Define colors by what they do: primary actions, success states, warnings, and text levels. That keeps the system consistent as features grow.</p><ul><li>Neutrals for structure and hierarchy</li><li>One or two accent hues maximum</li><li>Explicit error and success colors</li></ul><h2>Accessibility first</h2><p>Check every foreground/background pairing against WCAG contrast targets. Good contrast is not optional styling — it is the baseline.</p>`,
    category: 'Design',
    status: 'published',
    views: 860,
  },
  {
    title: 'The Remote Work Playbook for Distributed Teams',
    summary: 'Practical systems for async communication, documentation, and decision-making in a fully distributed team.',
    content: `<p>Remote work succeeds on documentation and trust. Teams that write things down can hire from anywhere and let people work when they are most effective.</p><h2>Default to async</h2><p>Write the update, record the demo, and let teammates catch up on their own schedule. Reserve synchronous time for decisions that truly need debate.</p><blockquote>The best remote teams treat their wiki as the product — if it isn't written down, it didn't happen.</blockquote><p>Build rituals that create shared context: weekly written digests, recorded demos, and a decision log.</p>`,
    category: 'Business',
    status: 'published',
    views: 640,
  },
  {
    title: 'Strength Training Fundamentals for Beginners',
    summary: 'Everything you need to start lifting safely: form cues, program structure, and how to progress without injury.',
    content: `<p>Strength training is the highest-leverage habit most beginners can adopt. It improves body composition, bone density, mood, and metabolic health.</p><h2>Start with the big patterns</h2><ul><li>Squat pattern — legs and core</li><li>Hinge pattern — posterior chain</li><li>Push pattern — chest, shoulders, triceps</li><li>Pull pattern — back and biceps</li></ul><p>Progress comes from adding a little load or one extra rep each session, while keeping form honest.</p>`,
    category: 'Health',
    status: 'published',
    views: 1550,
  },
  {
    title: "What Quantum Computing Will (and Won't) Do",
    summary: 'Separating the hype from the physics in the race toward fault-tolerant quantum computers.',
    content: `<p>Quantum computers are not faster versions of today's machines. They are a different kind of machine, useful for a narrow set of problems.</p><h2>Where they shine</h2><p>Factoring, simulation of quantum systems, and certain optimization problems have the potential for enormous speedups.</p><h2>What they won't do</h2><p>They will not make your laptop faster, and most classical workloads — databases, web services, video — are completely unaffected.</p><blockquote>The real revolution is in the handful of problems classical computers may never solve efficiently.</blockquote>`,
    category: 'Science',
    status: 'published',
    views: 980,
  },
  {
    title: 'A Minimalist System for Daily Productivity',
    summary: 'Forget the elaborate planners. A simple three-part daily system that actually survives contact with real life.',
    content: `<p>Productivity systems fail because they demand more maintenance than the work itself. The answer is a tiny, repeatable loop.</p><h2>The three lists</h2><ul><li>Top three priorities for the day</li><li>A short task list you actually finish</li><li>A notes inbox for capture</li></ul><p>Plan in the morning, review in the evening, and protect one block of deep work. Everything else is negotiation.</p>`,
    category: 'Lifestyle',
    status: 'published',
    views: 720,
  },
  {
    title: 'Learning in Public: How Sharing Accelerates Mastery',
    summary: 'Why writing about what you learn beats passive study, and how to start sharing without fear of judgment.',
    content: `<p>Teaching is the fastest path to understanding. When you write something for an audience, the gaps in your knowledge become impossible to ignore.</p><h2>Start embarrassingly small</h2><p>Publish a note, a small script, or a one-paragraph explanation of a concept you just learned. Volume beats polish at the start.</p><blockquote>Your future readers are beginners. Write for them, not for experts.</blockquote><p>The feedback loop — write, get corrected, revise — compounds faster than any course.</p>`,
    category: 'Education',
    status: 'published',
    views: 590,
  },
  {
    title: 'Budget Travel in Southeast Asia: A 30-Day Itinerary',
    summary: 'A realistic daily budget and route through Thailand, Vietnam, and Cambodia for first-time travelers.',
    content: `<p>Traveling cheaply doesn't mean missing out. It means spending on experiences and skipping the things you don't actually care about.</p><h2>Day-by-day route</h2><ul><li>Bangkok → Chiang Mai (1 week)</li><li>Chiang Mai → Hanoi (4 days)</li><li>Hanoi → Da Nang → Ho Chi Minh City (10 days)</li><li>HCMC → Siem Reap (1 week)</li></ul><p>Expect to spend $25–35 a day for a hostel, street food, and the occasional tour. The memories are priceless, the receipts are not.</p>`,
    category: 'Travel',
    status: 'published',
    views: 2010,
  },
  {
    title: 'The Science of a Perfect Home-Cooked Meal',
    summary: 'Kitchen techniques backed by food science that instantly upgrade your cooking.',
    content: `<p>Great home cooking is mostly about heat control and salt. Master those two and you are 80% of the way there.</p><h2>Salt early, taste often</h2><p>Salt layers flavor. Season each layer as you go rather than dumping it all at the end.</p><h2>Let the pan talk</h2><p>The Maillard reaction needs a hot, dry surface. Pat proteins dry and don't crowd the pan.</p><blockquote>Cooking is chemistry you get to eat.</blockquote>`,
    category: 'Food',
    status: 'published',
    views: 880,
  },
  {
    title: 'Index Funds Explained for Nervous Beginners',
    summary: 'The simple case for broad market index funds, and how to avoid the traps that trip up new investors.',
    content: `<p>Most people do not need to pick individual stocks. A broad index fund gives you ownership in the entire market with minimal fees and effort.</p><h2>The core argument</h2><ul><li>Diversification reduces risk without reducing expected return</li><li>Fees compound against you over decades</li><li>Time in the market beats timing the market</li></ul><p>Set up automatic contributions, ignore the noise, and check your portfolio once a quarter.</p>`,
    category: 'Finance',
    status: 'published',
    views: 1330,
  },
  {
    title: 'Draft: A Working Draft About CSS Grid',
    summary: 'Notes from a working session on modern CSS Grid layouts.',
    content: `<p>Grid gives us true two-dimensional layout. Rows and columns can be defined independently and items placed explicitly.</p><h2>Key concepts</h2><ul><li><code>grid-template-columns</code> and <code>grid-template-rows</code></li><li><code>fr</code> units for flexible tracks</li><li><code>gap</code> for spacing</li></ul><p>Still editing this one before submitting for review.</p>`,
    category: 'Technology',
    status: 'draft',
    views: 0,
  },
  {
    title: 'Pending Review: Deep Work in a Distracted World',
    summary: 'An essay on reclaiming focus, waiting for editor approval.',
    content: `<p>Attention is the scarcest resource of the information age. This essay explores practical ways to defend it.</p><p>Awaiting admin review before it can go live.</p>`,
    category: 'Lifestyle',
    status: 'pending',
    views: 0,
  },
];

async function seed() {
  console.log('[seed] Seeding database...');

  const users = [
    {
      name: 'Readify Admin',
      email: 'admin@readify.app',
      password: 'Admin123!',
      role: 'admin',
    },
    {
      name: 'Alice Johnson',
      email: 'alice@readify.app',
      password: 'User123!',
      role: 'user',
    },
    {
      name: 'Bob Martinez',
      email: 'bob@readify.app',
      password: 'User123!',
      role: 'user',
    },
  ];

  const userIds = {};
  for (const u of users) {
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', u.email);
    let id;
    if (existing) {
      id = existing.id;
    } else {
      const hash = await bcrypt.hash(u.password, 12);
      const info = await dbRun(
        'INSERT INTO users (name, email, password_hash, role, avatar) VALUES (?, ?, ?, ?, ?)',
        u.name, u.email, hash, u.role, avatarDataUri(u.name)
      );
      id = Number(info.lastInsertRowid);
    }
    userIds[u.email] = id;
  }

  const catId = {};
  for (const name of CATEGORIES) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await dbRun('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)', name, slug);
    catId[name] = (await dbGet('SELECT id FROM categories WHERE slug = ?', slug)).id;
  }

  for (let i = 0; i < ARTICLES.length; i++) {
    const a = ARTICLES[i];
    const title = a.title;
    const existing = await dbGet('SELECT id FROM articles WHERE title = ?', title);
    if (existing) continue;

    const userEmail = i < 8 ? 'alice@readify.app' : i < 10 ? 'bob@readify.app' : 'bob@readify.app';
    const published_at =
      a.status === 'published'
        ? new Date(Date.now() - i * 86400000 * 3).toISOString()
        : null;
    const content = sanitizeContent(a.content);
    const created_at = new Date(Date.now() - (i + 3) * 86400000).toISOString();

    const info = await dbRun(
      `INSERT INTO articles
        (user_id, title, author, category_id, summary, content, status, views_count, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userIds[userEmail],
      title,
      a.author || null,
      catId[a.category],
      a.summary,
      content,
      a.status,
      a.views || 0,
      created_at,
      created_at,
      published_at
    );

    setArticleTags(Number(info.lastInsertRowid), TAG_SETS[a.category]);
  }

  const published = await dbAll("SELECT id FROM articles WHERE status = 'published'");
  const featuredIds = published.slice(0, 3).map((a) => a.id);
  for (const id of featuredIds) {
    const featuredAt = USE_SUPABASE ? 'NOW()' : "COALESCE(featured_at, datetime('now'))";
    await dbRun(
      `UPDATE articles SET featured = 1, featured_at = ${featuredAt} WHERE id = ?`,
      id
    );
  }
  for (let i = 0; i < published.length; i++) {
    const id = published[i].id;
    const c = 2 + (i % 5);
    for (let j = 0; j < c; j++) {
      const userKey = ['alice@readify.app', 'bob@readify.app'][j % 2];
      await dbRun(
        `INSERT OR IGNORE INTO comments (article_id, user_id, content, created_at)
         VALUES (?, ?, ?, ?)`,
        id,
        userIds[userKey],
        `Great read — point ${j + 1} really resonated with me.`,
        new Date(Date.now() - (j + 1) * 3600000).toISOString()
      );
    }
    const likes = 3 + (i % 6);
    for (let j = 0; j < likes; j++) {
      await dbRun(
        `INSERT OR IGNORE INTO reactions (article_id, user_id, type) VALUES (?, ?, ?)`,
        id, userIds['bob@readify.app'], 'like'
      );
    }
    await dbRun(
      'UPDATE articles SET reactions_count = (SELECT COUNT(*) FROM reactions WHERE article_id = ?), comments_count = (SELECT COUNT(*) FROM comments WHERE article_id = ?) WHERE id = ?',
      id, id, id
    );
    await dbRun('INSERT OR IGNORE INTO bookmarks (article_id, user_id) VALUES (?, ?)',
      id,
      userIds['alice@readify.app']
    );
  }

  for (const host of ['admin.readify-domain-1.com', 'admin.readify-domain-2.com']) {
    await dbRun('INSERT OR IGNORE INTO domains (host, label) VALUES (?, ?)',
      host,
      host === 'admin.readify-domain-1.com' ? 'Admin Portal - Primary' : 'Admin Portal - Secondary'
    );
  }

  await setSetting('site_name', 'Readify');
  await setSetting('site_tagline', 'Read, write, and share great stories.');
  await setSetting('allow_registration', '1');
  await setSetting('articles_per_page', '12');
  await setSetting('require_review_before_publish', '1');

  console.log('[seed] Done.');
  const counts = {
    users: (await dbGet('SELECT COUNT(*) AS c FROM users')).c,
    articles: (await dbGet('SELECT COUNT(*) AS c FROM articles')).c,
    comments: (await dbGet('SELECT COUNT(*) AS c FROM comments')).c,
    reactions: (await dbGet('SELECT COUNT(*) AS c FROM reactions')).c,
    domains: (await dbGet('SELECT COUNT(*) AS c FROM domains')).c,
  };
  console.log('[seed]', JSON.stringify(counts));
  if (!USE_SUPABASE) {
    db.close();
  }
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
