/*
 * datalog-help.js — the manual, and the reader that displays it.
 *
 * ONE source of content for every place BigData runs: the Windows app opens it in its own Help window,
 * the website publishes the same topics as pages, and any host can mount the same reader. Shipped with
 * the engine so it can never drift from the build it documents.
 *
 * Content shape:
 *   topic   { id, title, summary, tags: [..], sections: [ { id, h, html } ] }
 *   html    plain HTML, no scripts, no external images. JS strings here are DOUBLE quoted and HTML
 *           attributes single quoted, so apostrophes in the prose never need escaping.
 *
 * Helper classes the stylesheet knows: .hlp-note (worth stopping for), .hlp-warn (prevents a mistake),
 * .hlp-keys (a two- or three-column reference table), .hlp-steps (a numbered procedure), .hlp-pro
 * (marks a Pro-only feature inline).
 *
 * The reader gives you a contents list, a search box over the full text, deep links (#topic or
 * #topic/section) and printable output, with no framework and no build step, so it works from file://
 * inside the desktop app's Help window.
 */
(function (global) {
  'use strict';

  var PRO = "<span class='hlp-pro' title='Requires an AllDataLogs Pro membership'>Pro</span>";

  var TOPICS = [

    // =============================================================================================
    {
      id: 'getting-started',
      title: 'Getting started',
      summary: "What BigData is, where it runs, and the first five minutes from a log file to a graph.",
      tags: ['intro', 'first', 'start', 'overview', 'basics'],
      sections: [
        {
          id: 'what-it-is', h: 'What BigData is',
          html:
            "<p>BigData is a datalog viewer for engine tuners. You open a log from a scanner or an ECU and it " +
            "gives you graphs, gauge dashboards and VCM-Scanner-style histogram tables over the same data, with " +
            "nothing to import and nothing to convert first.</p>" +
            "<p>It runs in three places, and they are the same viewer:</p>" +
            "<ul>" +
            "<li><b>The website</b> at alldatalogs.com. Nothing to install, works on any computer, and there is " +
            "a free tier.</li>" +
            "<li><b>BigData for Windows.</b> The desktop app: opens logs by double-click, remembers your files, " +
            "and keeps working without a connection. It is part of Pro.</li>" +
            "<li><b>The phone and tablet apps.</b> A stripped-back build for looking at a log at the track. " +
            "Landscape only on a phone, and no histogram tables there. Also part of Pro.</li>" +
            "</ul>" +
            "<p>Saved layouts, gauge dashboards and history follow your account, so what you set up at the shop " +
            "is what you see at home.</p>",
        },
        {
          id: 'first-log', h: 'Open your first log',
          html:
            "<ol class='hlp-steps'>" +
            "<li>Drag a log onto the window, or use <b>Open log…</b>.</li>" +
            "<li>The viewer picks a starting view for the car it sees. A log with per-cylinder knock opens on a " +
            "V8 or V6 gauge cluster; anything else opens on a standard dash or on graphs and cards.</li>" +
            "<li>Tick channels in the list on the left to plot them. The <b>U</b> and <b>L</b> buttons beside " +
            "each channel choose which graph it goes on.</li>" +
            "<li>Drag across a graph to pan, roll the wheel to zoom, and drag the red window along the bar at " +
            "the bottom to move through the log.</li>" +
            "<li>Hover anywhere on a graph: a line follows the pointer and every readout on screen shows that " +
            "moment.</li>" +
            "</ol>" +
            "<p>Nothing you do changes the log file. Layouts, tables and dashboards are saved separately.</p>",
        },
        {
          id: 'free-pro', h: 'Free and Pro, in one line',
          html:
            "<p>On the <b>website</b>, opening logs, graphs, the built-in gauges and the channel list are free, " +
            "for logs up to 15 MB. A membership adds the things you build and keep. <b>The Windows app and the " +
            "phone apps are Pro only</b>: anyone can install them, but they need an active membership to open a " +
            "log.</p>" +
            "<p>Anything marked " + PRO + " in this manual needs a membership. " +
            "<a href='#pro'>Free and Pro</a> has the full split, the file-size limits and how offline works.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'install-windows',
      title: 'Installing BigData for Windows',
      summary: "Downloading the beta, getting past the Windows warning, signing in, updates, and where your things are kept.",
      tags: ['install', 'download', 'windows', 'smartscreen', 'update', 'uninstall', 'beta', 'sign in'],
      sections: [
        {
          id: 'download', h: 'Download and install',
          html:
            "<div class='hlp-note'><b>BigData for Windows is part of AllDataLogs Pro.</b> Anyone can download " +
            "the installer, but it needs an active Pro membership to open a log. If you sign in without one you " +
            "get a screen offering <b>Start Pro</b> and <b>Manage subscription</b> rather than a dead end.</div>" +
            "<p>The app is also a <b>beta</b>. It is stable enough for daily use and it updates itself, but " +
            "expect changes between versions, and tell us when something is wrong.</p>" +
            "<ol class='hlp-steps'>" +
            "<li>Download <code>BigData-Setup-&lt;version&gt;.exe</code> from the download page.</li>" +
            "<li>Run it. It installs for the current Windows user only, so it never asks for an administrator " +
            "password, and you can choose the folder.</li>" +
            "<li>Sign in with your alldatalogs.com account.</li>" +
            "</ol>",
        },
        {
          id: 'smartscreen', h: 'Windows will warn you the first time',
          html:
            "<div class='hlp-warn'><b>You have to approve the install by hand.</b> Windows SmartScreen shows " +
            "&ldquo;Windows protected your PC&rdquo; for installers it has not seen before. Click <b>More " +
            "info</b>, then <b>Run anyway</b>. This is not a virus warning.</div>" +
            "<p>Your browser may also hold the download with a <b>Keep</b> or <b>Keep anyway</b> option. Same " +
            "reason, same answer.</p>" +
            "<p>It happens because the installer is not yet code-signed with a certificate Windows recognises. " +
            "Signing is in progress. Once it is live the publisher name appears instead of &ldquo;Unknown " +
            "publisher&rdquo;, and the warning stops once enough people have installed that version.</p>",
        },
        {
          id: 'signing-in', h: 'Signing in',
          html:
            "<p>The app needs to reach alldatalogs.com once to activate on this PC. After that it keeps a signed " +
            "statement of your membership and re-checks quietly in the background, so it opens and works with no " +
            "connection at all.</p>" +
            "<p>If you sign in with an account that has no membership you get a screen offering <b>Start Pro</b>, " +
            "<b>Manage subscription</b>, <b>Check again</b> and <b>Sign out</b>, rather than a dead end. A log " +
            "you double-clicked before signing in is queued and opens as soon as you are in.</p>" +
            "<p>Signing out here does not sign you out of the website in your browser.</p>",
        },
        {
          id: 'updates', h: 'Updates',
          html:
            "<p>The app checks for a new version a few seconds after it starts, then every four hours while it " +
            "runs. A new version downloads in the background and then asks whether to restart; choose " +
            "<b>Restart now</b> and it installs itself, or <b>Later</b> and it waits. You can also check by " +
            "hand at any time.</p>" +
            "<p>Updates are cumulative, so a machine several versions behind jumps straight to the newest one. " +
            "<a href='#changelog'>What is new</a> lists every release.</p>",
        },
        {
          id: 'files', h: 'Where your things are kept',
          html:
            "<p>Everything the app stores lives under <code>%APPDATA%\\BigData</code>:</p>" +
            "<table class='hlp-keys'><tbody>" +
            "<tr><td><code>session.bin</code></td><td>Your sign-in, encrypted by Windows for your user account. " +
            "Deleted when you sign out.</td></tr>" +
            "<tr><td><code>license.json</code></td><td>The signed statement of your membership and when it was " +
            "last checked. It is tied to this installation, so copying it elsewhere does nothing.</td></tr>" +
            "<tr><td><code>recent.json</code></td><td>Your History list of local files, kept separately for each " +
            "account that signs in on this PC. Paths only, never copies of your logs.</td></tr>" +
            "<tr><td><code>history.json</code></td><td>The &ldquo;Save opened logs to my account&rdquo; switch.</td></tr>" +
            "<tr><td>Browser storage</td><td>Saved layouts and dashboards, histogram definitions, math channels, " +
            "smoothing, and your preferences.</td></tr>" +
            "</tbody></table>" +
            "<p>Uninstalling leaves that folder alone, so reinstalling gets you back what you had. Anything that " +
            "synced to your account is on the server too, so a new PC only needs a sign-in.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'opening-logs',
      title: 'Opening logs',
      summary: "Every way a log gets in, what happens while it opens, the size limits, and what to do when one will not.",
      tags: ['open', 'file', 'drag', 'drop', 'associations', 'size', 'limit', 'downsampled'],
      sections: [
        {
          id: 'ways', h: 'Four ways in',
          html:
            "<ul>" +
            "<li><b>Drag and drop</b> a file onto the window.</li>" +
            "<li><b>Open log…</b> on the home screen, or the File menu in the Windows app.</li>" +
            "<li><b>Double-click a log</b> in Explorer. The Windows app registers as a handler for " +
            "<code>.hpl</code>, <code>.ld</code> and <code>.dl</code>. Windows will not take a file type away " +
            "from VCM Scanner or i2 by itself, so the first time you may need <b>Open with &rarr; Choose another " +
            "app &rarr; BigData</b>, ticking &ldquo;Always use this app&rdquo; if you want it to stick. " +
            "<code>.csv</code> is deliberately not claimed, because on most machines that belongs to Excel.</li>" +
            "<li><b>History</b>, on the home screen. Click any log you have opened before; rows saved to your " +
            "account download and open on any device.</li>" +
            "</ul>",
        },
        {
          id: 'what-happens', h: 'What happens while it opens',
          html:
            "<p>The file is decoded, channels are matched to known roles (RPM, throttle, lambda and so on), " +
            "units are converted to US measures, and calculated channels are added.</p>" +
            "<p>Graphs are drawn from a reduced set of at most 12,000 points so panning and zooming stay quick, " +
            "while <b>histograms bin the full-resolution data underneath</b>. That is why a table can report far " +
            "more samples than the graph appears to contain, and it is deliberate: the tables are what you tune " +
            "from. The header says <b>&ldquo;N of M rows&rdquo;</b> and notes that the display is downsampled " +
            "whenever that happened.</p>" +
            "<p>A very large log is thinned even for the tables, above roughly 40 million values on a computer " +
            "and less on a phone. The histogram toolbar then shows a <b>downsampled</b> badge, so you know the " +
            "counts are of the samples kept rather than of the whole log.</p>",
        },
        {
          id: 'limits', h: 'Size limits',
          html:
            "<table class='hlp-keys'><thead><tr><th>Where</th><th>Limit</th></tr></thead><tbody>" +
            "<tr><td>Website, free</td><td>15 MB</td></tr>" +
            "<tr><td>Website, Pro</td><td>250 MB</td></tr>" +
            "<tr><td>BigData for Windows</td><td>250 MB</td></tr>" +
            "<tr><td>Phone</td><td>About 25 MB for an .hpl, 40 MB for MoTeC or Holley, 80 MB for a CSV</td></tr>" +
            "<tr><td>Tablet</td><td>About 50 MB for an .hpl, 80 MB for MoTeC or Holley, 150 MB for a CSV</td></tr>" +
            "</tbody></table>" +
            "<p>Phones are lower because they have far less memory to work with, and the limit depends on the " +
            "format because a compressed binary log expands enormously once decoded. The message always names " +
            "the size of your file and the limit that applies, and suggests the website or the Windows app when " +
            "a log is too big for the phone.</p>",
        },
        {
          id: 'wont-open', h: 'When a log will not open',
          html:
            "<p>You get a message saying why, rather than a blank screen. The usual causes:</p>" +
            "<ul>" +
            "<li><b>The format needs exporting first.</b> Some tools encrypt their own log container. See " +
            "<a href='#formats/exports'>Supported formats</a>.</li>" +
            "<li><b>The file is too big</b> for the device you are on.</li>" +
            "<li><b>The log is cut off.</b> A log that stopped mid-write often loses the block it was writing. " +
            "Where the rest can still be read you get the log plus a note that it looks truncated.</li>" +
            "<li><b>It is not a datalog</b> at all, or it is a CSV with no recognisable time column.</li>" +
            "</ul>" +
            "<p>If a log fails to open for a Palm Beach Dyno address it is uploaded automatically so the decoder " +
            "can be fixed, and you do not have to send anything.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'formats',
      title: 'Supported formats',
      summary: "Which files open, which need an export first, and the quirks of each tool.",
      tags: ['format', 'hpl', 'hptuners', 'motec', 'holley', 'sct', 'haltech', 'fueltech', 'megasquirt', 'csv', 'export'],
      sections: [],   // built below from FORMATS so the table and the prose cannot disagree
    },

    // =============================================================================================
    {
      id: 'the-screen',
      title: 'The screen, part by part',
      summary: "What every area is for, including the two different controls both called Layout.",
      tags: ['layout', 'header', 'tabs', 'scrubber', 'cursor', 'ui'],
      sections: [
        {
          id: 'areas', h: 'The areas',
          html:
            "<ul>" +
            "<li><b>Header.</b> The file name, how many rows were kept, the build number, the two pickers " +
            "(<b>Layout</b> and <b>Custom Gauges</b>), <b>Reset Zoom</b>, the <b>Analyze</b> and <b>Layout</b> " +
            "menus, and Close.</li>" +
            "<li><b>Channel list</b> on the left, on every tab.</li>" +
            "<li><b>Tabs:</b> <b>Graph</b>, <b>Gauges</b>, <b>Histograms</b>. They share one log, one zoom " +
            "window and one cursor, so a cell you click in a table and a moment you hover on a graph are the " +
            "same moment.</li>" +
            "<li><b>Overview bar</b> at the bottom: the whole log end to end, with a red window showing what " +
            "you are zoomed into, a playhead at the cursor, and a mark at your race zero.</li>" +
            "<li><b>Time readout</b> left of that bar: the log's own time at the cursor, or your race time once " +
            "you set a zero at your launch. It keeps one width, so nothing beside it shifts as the numbers change.</li>" +
            "</ul>",
        },
        {
          id: 'two-layouts', h: 'The two controls called Layout',
          html:
            "<div class='hlp-note'>The word appears twice in the header and they are different things." +
            "<ul>" +
            "<li>The <b>Layout picker</b> on the left shows <i>which</i> layout is loaded and lets you switch " +
            "to another one, or to a built-in view.</li>" +
            "<li>The <b>Layout menu</b> on the right is where you <i>save</i>, save as new, delete, or download " +
            "the original log.</li>" +
            "</ul></div>" +
            "<p>Both picker buttons show the loaded item underneath their caption, with a <b>*</b> after the " +
            "name when you have changed something that is not saved yet.</p>",
        },
        {
          id: 'cursor', h: 'The cursor',
          html:
            "<p>Move the pointer over any graph and a vertical line follows it on every panel at once. The " +
            "channel list values, the cards, the gauges, the legends, the race time and the live dot on a " +
            "histogram all read that instant. The position sticks when you move away, so you can read the " +
            "numbers without holding the mouse still.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'channels',
      title: 'The channel list',
      summary: "Finding channels, favorites, folding the sections, putting them on graphs, smoothing, and what each glyph means.",
      tags: ['channels', 'search', 'filter', 'badge', 'units', 'value', 'sort', 'smoothing', 'favorites', 'star', 'sections'],
      sections: [
        {
          id: 'find', h: 'Finding a channel',
          html:
            "<p>Type in <b>Filter channels…</b> to narrow the list, and use the <b>&times;</b> in the box to " +
            "clear it. Under the box are three filter buttons, each showing how many channels of that kind this " +
            "log has:</p>" +
            "<table class='hlp-keys'><tbody>" +
            "<tr><td><b>&#9673;</b></td><td><b>Logged</b> channels, recorded by the scanner or the ECU.</td></tr>" +
            "<tr><td><b>&fnof;</b></td><td><b>Math</b> channels you defined yourself.</td></tr>" +
            "<tr><td><b>&asymp;</b></td><td><b>Calculated</b> channels, estimated from this log by the viewer.</td></tr>" +
            "</tbody></table>" +
            "<p>Light none and you see everything; light several and you see their union. It stacks with the " +
            "search text, and it lasts for the session rather than being saved. The same badges appear on the " +
            "rows, so you can always tell a logged value from a derived one.</p>" +
            "<p>Click a column header to sort by it, and again to reverse. Drag the <b>&equiv;</b> grip to put " +
            "the list in your own order instead.</p>",
        },
        {
          id: 'favorites', h: 'Favorites and the sections',
          html:
            "<p>Every row has a star. Click it and the channel moves into a <b>Favorites</b> section at the very " +
            "top of the list, and it stays starred on every log you open afterwards \u2014 the handful of channels " +
            "you always look at are one glance away instead of a search away. Click the star again to send the " +
            "channel back where it came from.</p>" +
            "<p>Below Favorites the list is divided into the three kinds, each with its own heading and a count:</p>" +
            "<table class='hlp-keys'><tbody>" +
            "<tr><td><b>&#9673;</b></td><td><b>Logged channels</b> \u2014 what the scanner recorded.</td></tr>" +
            "<tr><td><b>&fnof;</b></td><td><b>Math channels</b> \u2014 the ones you defined.</td></tr>" +
            "<tr><td><b>&asymp;</b></td><td><b>Calculated</b> \u2014 estimated from this log by the viewer.</td></tr>" +
            "</tbody></table>" +
            "<p>Click a heading to fold that section away; the count keeps telling you how many are inside, and " +
            "the app remembers which sections you had folded. A heading only appears for a kind this log actually " +
            "has. While you are typing in the filter box every section opens, so a search can never hide its own " +
            "results behind a folded heading.</p>",
        },
        {
          id: 'place', h: 'Putting a channel on a graph',
          html:
            "<p>Tick the box to plot a channel; the first one you tick goes on the upper graph. The letter " +
            "buttons choose the panel: <b>U</b> upper, <b>M</b> middle, <b>M2</b> the second middle when four " +
            "graphs are showing, <b>L</b> lower. Clicking the lit letter again takes it off that panel.</p>" +
            "<p>You can also drag a channel by its <b>&equiv;</b> grip straight onto the panel you want. The " +
            "panel highlights as you pass over it.</p>" +
            "<p>The footer shows <b>N of M channels selected</b> with a <b>Clear All</b> button.</p>",
        },
        {
          id: 'row-tools', h: 'The controls on a row',
          html:
            "<table class='hlp-keys'><tbody>" +
            "<tr><td><b>&equiv;</b></td><td>Drag to reorder the list, or onto a graph to plot it there.</td></tr>" +
            "<tr><td><b>&#9734;</b> <b>&#9733;</b></td><td>Favorite. Lit means starred, and starred channels sit " +
            "in Favorites at the top of every log.</td></tr>" +
            "<tr><td><b>&fnof;</b> <b>&asymp;</b></td><td>Math channel / calculated channel.</td></tr>" +
            "<tr><td><b>&#9881;</b></td><td>On calculated rows only: the settings behind the estimate.</td></tr>" +
            "<tr><td><b>&#8767;</b></td><td>Smoothing for this channel. Lit, with the window beside it, when on.</td></tr>" +
            "<tr><td><b>&#9679;</b></td><td>In the Gauge column: this channel is on one of the gauges showing now.</td></tr>" +
            "</tbody></table>",
        },
        {
          id: 'text', h: 'Text channels',
          html:
            "<p>Channels whose values are states rather than numbers, such as spark source, fuel system status " +
            "or the limiter, are kept as text. They are not averaged and not drawn as a line, but they read " +
            "correctly in the list, on a <b>Table</b> gauge, and in a histogram filter.</p>" +
            "<p>A mostly-numeric channel with a few odd cells stays numeric; the odd cells become gaps rather " +
            "than turning the whole channel into text.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'graphs',
      title: 'Graphs',
      summary: "Panels, cards, zooming, dragging past the end of a log, the legend, per-channel axis ranges, race zero and comparing.",
      tags: ['graph', 'zoom', 'pan', 'legend', 'compare', 'race', 'scrubber', 'axis'],
      sections: [
        {
          id: 'panels', h: 'One to four panels',
          html:
            "<p>The small <b>1 2 3 4</b> buttons in the top-left of the upper graph choose how many panels you " +
            "see. All four are offered on the <b>Graph</b> tab, which has the whole window; on the Gauges and " +
            "Histograms tabs the pane is shared with the dashboard or the table, so three is the most.</p>" +
            "<p>The fourth panel is added <i>above</i> the bottom graph, so a channel on the lower panel stays " +
            "on the bottom whether you show two, three or four. Drop back to fewer panels and channels on a " +
            "hidden panel are drawn on the bottom one instead of vanishing; they return to their own panel when " +
            "you go back.</p>" +
            "<p>Above the graphs, a card per selected channel shows its live value with minimum, maximum and " +
            "average for the log. Past eight cards the rest are behind <b>+ N more selected channels</b>.</p>",
        },
        {
          id: 'zoom', h: 'Zooming and panning',
          html:
            "<table class='hlp-keys'><tbody>" +
            "<tr><td>Drag a graph</td><td>Pan through the log. Both panels stay locked together.</td></tr>" +
            "<tr><td>Wheel</td><td>Zoom around the pointer.</td></tr>" +
            "<tr><td>Shift + drag</td><td>Drag out a span and release to zoom to it.</td></tr>" +
            "<tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd></td><td>Zoom in and out around the cursor.</td></tr>" +
            "<tr><td><kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Step the cursor one sample.</td></tr>" +
            "<tr><td>The red window</td><td>Drag it to move; drag either edge to zoom that end only; click the " +
            "bar anywhere else to centre there.</td></tr>" +
            "<tr><td><b>+</b> <b>&minus;</b></td><td>Zoom buttons beside the overview bar.</td></tr>" +
            "<tr><td><b>&#9974;</b></td><td>Fullscreen. In the phone and tablet apps this button closes the log " +
            "instead.</td></tr>" +
            "<tr><td><b>&#8635; Reset Zoom</b></td><td>Back to the whole log.</td></tr>" +
            "</tbody></table>" +
            "<p>On a touch screen one finger moves the cursor and two fingers pan or pinch, so you can read " +
            "values without the graph sliding around.</p>",
        },
        {
          id: 'overscroll', h: 'Dragging past the end',
          html:
            "<p>A run that ends at the finish line leaves the interesting part jammed against the right edge. " +
            "You can drag the graph past either end of the log, by up to half a screen, so the last samples sit " +
            "where you can read them. The empty part is shaded, with a dashed line marked <b>log end</b> or " +
            "<b>log start</b>, so a gap never looks like missing data. Zoom right out and the view snaps back to " +
            "exactly the log.</p>",
        },
        {
          id: 'legend', h: 'The legend',
          html:
            "<p><b>Docked, HP Tuners style.</b> Each graph's legend starts docked in a column down its left " +
            "side, every channel shown as its name and unit over a large value in its own colour, with its value " +
            "at the cursor. The column always fits its graph: when space runs short the text steps down, busy " +
            "graphs pair the tiles or switch to a compact list, and long names are abbreviated word by word, never scrolled or " +
            "cut off at the end. Only on a graph too short to show every channel at any size do the last few " +
            "step out, counted by a small +N you can hover to see them. All the graphs dock together, so their time axes " +
            "stay lined up under one crosshair. Click the <b>&times;</b> beside a channel to take it off the graph.</p>" +
            "<p><b>Floating.</b> Drag any docked column out onto a graph and every legend becomes a small window " +
            "over its graph instead; the one you dragged lands where you let go. Drag a floating legend to move " +
            "it, drag its corner handle to resize it, and double-click it to put it back in its corner. Drag one " +
            "to the left edge of its graph (the strip lights up) to dock them all again. Floating is remembered " +
            "once you choose it, and saved with a Layout.</p>",
        },
        {
          id: 'right-click', h: 'Right-click a graph',
          html:
            "<p>The menu opens headed with the exact time you clicked, and holds two things:</p>" +
            "<ul>" +
            "<li><b>Set race zero here</b> " + PRO + ", and <b>Clear race zero</b> once one is set. With a " +
            "comparison loaded you get one for each log, and the two are used to align them.</li>" +
            "<li><b>Y-axis range.</b> One row per channel on that panel, with a minimum, a maximum and " +
            "<b>Set</b>. <b>Auto</b> returns a channel to automatic scaling. Use it when one channel's spikes " +
            "flatten everything else.</li>" +
            "</ul>",
        },
        {
          id: 'race', h: 'Race zero',
          html:
            "<p>Set a zero point " + PRO + " and the time axis reads from your launch instead of from the start " +
            "of the file, which is what makes two runs comparable. Right-click the moment on a graph, or use " +
            "<b>Set 0</b> in the race row. <b>&times;</b> clears it. The overview bar marks where the zero is.</p>" +
            "<p>Until a zero is set, the same readout shows <b>Time</b>: the log's own time at the cursor, as it " +
            "was recorded. Setting a zero switches it to <b>Race</b> in amber; clearing it switches back.</p>",
        },
        {
          id: 'compare', h: 'Comparing two logs',
          html:
            "<p><b>Analyze &rarr; Compare a second log</b> " + PRO + " draws a second log over the same axes. " +
            "The compare bar names it and says whether it is <b>aligned on race zero</b> or <b>aligned on " +
            "start</b>, with nudge buttons of 50 ms and 500 ms either way, the current offset, a reset, and " +
            "<b>&times;</b> to remove the comparison.</p>",
        },
        {
          id: 'perf', h: 'Time slips, laps and Dragy',
          html:
            "<p><b>Analyze</b> also takes performance data " + PRO + ": a <b>time slip</b>, <b>lap times</b> or " +
            "a <b>Dragy</b> run. The increments draw on the graphs in race mode, so set a race zero at the " +
            "launch first. <b>Clear performance data</b> removes it.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'gauges',
      title: 'Gauges and dashboards',
      summary: "The built-in clusters, editing a gauge, and building your own dashboard from the palette.",
      tags: ['gauge', 'dash', 'dashboard', 'designer', 'fascia', 'cluster', 'palette', 'threshold'],
      sections: [
        {
          id: 'default', h: 'The built-in clusters',
          html:
            "<p>The Gauges tab has two sub-views, <b>Default</b> and <b>Custom</b>. Default is the cluster " +
            "chosen for the car in the log: a V8 or V6 cluster when the log carries per-cylinder knock, " +
            "otherwise a standard dash. You can switch to any of them from the Layout picker, which lists " +
            "<b>Default View</b>, <b>Graph View</b>, <b>V8 Gauge</b>, <b>V6 Gauge</b> and <b>Standard Dash</b>.</p>" +
            "<p>Clusters bind to <i>roles</i> rather than to channel names, which is why the same cluster works " +
            "on a Ford, a Holley and a MoTeC log as long as each logs the equivalent channel.</p>" +
            "<p>Drag the divider under the cluster to scale the gauges; double-click it to go back to " +
            "automatic.</p>",
        },
        {
          id: 'edit-fascia', h: 'Adjusting a built-in gauge',
          html:
            "<p>Each gauge carries a <b>&#9998;</b> button that turns on drag handles: drag the end numbers to " +
            "change the range, drag the coloured ring handles to move the warning and red zones.</p>" +
            "<p>Right-click a gauge for the full menu, in three tabs:</p>" +
            "<ul>" +
            "<li><b>Mapping.</b> Point the gauge at any channel. The first entry is the automatic choice, and " +
            "the hint says it plainly: auto-mapping is just the default.</li>" +
            "<li><b>Warnings.</b> Warn above, warn below, critical above, critical below.</li>" +
            "<li><b>Scale.</b> Range, break points, snap step, font size, and the warning and redline zones.</li>" +
            "</ul>" +
            "<p>If a gauge cannot resolve on this log the menu leads with <b>Not available in this log</b> and " +
            "offers channels to map it to instead.</p>" +
            "<div class='hlp-note'>Changes to a built-in cluster last for the session. To keep a set of gauges, " +
            "build a custom dashboard and save it.</div>",
        },
        {
          id: 'custom', h: 'Building your own dashboard ' + PRO,
          html:
            "<p><b>Custom Gauges &rarr; + Build custom gauges</b> opens the designer. Drag a chip from the " +
            "floating palette onto the grid, then drag gauges to move them and their bottom-right corner to " +
            "resize. <b>Snap to grid</b> keeps things lined up, and holding <kbd>Alt</kbd> inverts it. Drag the " +
            "palette by its <b>&#9776;</b> header to get it out of the way.</p>" +
            "<p>The palette holds <b>Dial</b>, <b>Tach</b>, <b>RPM+MPH</b>, <b>Bar</b>, <b>H-Bar</b>, " +
            "<b>Number</b>, <b>Light</b> and <b>Table</b>.</p>" +
            "<p>Right-click any gauge for its panel: assign a channel on the left, and on the right set the " +
            "label, minimum, maximum, decimals, unit, font size, the yellow and red trigger points, the colour " +
            "(with <b>Apply to all</b>), and which end a bar fills from. The same panel has " +
            "<b>&#10683; Duplicate</b>, <b>&#10065; Copy gauge</b> and <b>&#128465; Delete gauge</b>. A copied " +
            "gauge pastes with <kbd>Ctrl</kbd>+<kbd>V</kbd> or the palette's <b>Paste gauge</b>, including into " +
            "another dashboard.</p>" +
            "<p><b>&#10003; Finalize</b> fits the canvas to your gauges and leaves edit mode. <b>&#8681; Load " +
            "gauges</b> replaces the gauges with a saved set while keeping your graphs. Once finalized, the " +
            "<b>&ctdot;</b> button offers <b>Edit dash</b>, <b>Share to library…</b> and <b>Delete dash</b>.</p>",
        },
        {
          id: 'table-gauge', h: 'The Table gauge',
          html:
            "<p>A Table gauge is a list of label-and-value rows, meant for the state fields that a dial cannot " +
            "show: spark source, fuel system status, what is limiting torque. Text values show as text, and " +
            "numeric state codes can be given names so you read &ldquo;Driver demand&rdquo; instead of a " +
            "number. Its header, width, font size and rows are all set from the same right-click panel.</p>",
        },
        {
          id: 'saving', h: 'Saving and sharing',
          html:
            "<p>Save a dashboard from the <b>Layout</b> menu with <b>Save Custom Gauges</b>. Saved dashboards " +
            "sync to your account " + PRO + " and appear wherever you sign in. <b>Browse the library…</b> pulls " +
            "in dashboards shared by other tuners, and <b>Share to library…</b> publishes yours.</p>" +
            "<div class='hlp-note'>A dashboard is also remembered <b>with</b> any layout you save while it is " +
            "showing, which is what makes switching layouts switch gauges. See <a href='#layouts'>Layouts</a>.</div>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'histograms',
      title: 'Histograms',
      summary: "Tuning tables over your log: building one, filtering it, reading a cell, paging it, and getting the numbers out.",
      tags: ['histogram', 'table', 'bins', 'breakpoints', 'filter', 'pages', 'owners', 'copy', 'hpt'],
      sections: [
        {
          id: 'what', h: 'What they are ' + PRO,
          html:
            "<p>A histogram bins the log into a table: a value averaged, or maximised, or counted, across two " +
            "axes you choose. Knock retard by RPM and airmass. Lambda error by MAF frequency. Converter slip by " +
            "RPM and gear. The same idea as VCM Scanner's histograms, over any log BigData can open, and always " +
            "computed on the full-resolution data.</p>" +
            "<p>Histograms are not available on a phone. A tablet gets them.</p>",
        },
        {
          id: 'build', h: 'Building one',
          html:
            "<ol class='hlp-steps'>" +
            "<li>Histograms tab, then <b>+ Add</b>.</li>" +
            "<li><b>Cell Parameter</b>: the value that fills the cells, as a channel, a role or a math " +
            "expression. It can also carry a weight channel.</li>" +
            "<li><b>Column Axis</b> and <b>Row Axis</b>: what the log is binned by, each with its own " +
            "breakpoints. Tick <b>No row axis</b> for a one-dimensional table.</li>" +
            "<li><b>Filter</b>: which samples count at all. <b>Simple</b> builds conditions and groups; " +
            "<b>Advanced</b> takes an expression. A live count tells you how many samples pass.</li>" +
            "<li><b>Display</b>: statistic, minimum hits, colour scale, whether higher is worse, and decimals.</li>" +
            "</ol>" +
            "<p>Breakpoints are cell centres, one per line. You can paste a row, a column or a whole table " +
            "straight from a tune, reverse or sort them, or generate a range by step or by count. Change the " +
            "unit and you are asked whether to convert the numbers you already have. An axis in a unit the log " +
            "does not use is converted for you, so a table binned in inHg still works on a log in psi.</p>" +
            "<p><kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves the editor.</p>",
        },
        {
          id: 'reading', h: 'Reading the table',
          html:
            "<p>The toolbar carries the <b>Statistic</b> (Average, Weighted, Minimum, Maximum, Last, Count), the " +
            "<b>Range</b> (<b>Entire Log</b> or <b>Selection</b>, which follows whatever the graphs are zoomed " +
            "to), <b>Min Hits</b> to dim cells with too few samples, <b>Show Low-Count</b> to reveal them " +
            "anyway, the <b>Color</b> scale (Auto or Manual with your own minimum, centre and maximum, and " +
            "which end reads as bad), and <b>Invert Axes</b> to swap rows and columns.</p>" +
            "<p>Click a cell and the strip underneath gives you weighted and plain averages, minimum, maximum, " +
            "first, last and the sample count, plus buttons to <b>Highlight</b> those samples on the overview " +
            "bar, <b>Jump to first</b>, <b>Jump to max</b> or <b>Zoom to samples</b>. Drag to select a block, " +
            "shift-click to extend, ctrl-click to add single cells, click a header to take a whole row or " +
            "column, and the corner to select everything.</p>" +
            "<p><b>Copy</b> puts the selection on the clipboard, <b>Copy With Axis</b> includes the axis labels, " +
            "and <b>Clear</b> recomputes from the log.</p>",
        },
        {
          id: 'pages', h: 'Paged tables',
          html:
            "<p>A table whose parameter contains <code>{n}</code>, for example <code>Mapped Point {n} " +
            "Weight</code> or <code>Total Fuel Trim {n}</code>, becomes one table you page through with " +
            "<b>&#9664; &#9654;</b> instead of eight nearly identical tables. The page button jumps straight to " +
            "any page, and <kbd>&larr;</kbd> and <kbd>&rarr;</kbd> step through them while the table has focus. " +
            "It works over logged channels and over math channels.</p>" +
            "<p><b>Owners</b> colours each cell by which page dominates it. The dropdown beside it decides what " +
            "dominates means: <b>by weight</b>, <b>by samples</b>, <b>by total value</b>, <b>by peak value</b> " +
            "or <b>by active samples</b>. Click a cell to see the split, and open any page from there.</p>",
        },
        {
          id: 'gauges-behind', h: 'Gauges behind the table',
          html:
            "<p>The list menu offers <b>Add gauges behind the table…</b>, which opens the same designer as a " +
            "dashboard. The gauges arrange themselves around the table: beside it when there is room, otherwise " +
            "below it, so a wide table never covers them.</p>",
        },
        {
          id: 'import', h: 'Bringing tables in and out',
          html:
            "<p>Each row's menu has <b>Export JSON</b>, <b>Import JSON…</b> and <b>Share to library…</b>, along " +
            "with duplicate, rename, enable, reorder and delete. The list menu adds <b>Load example set</b>, " +
            "<b>Import HP Tuners layout…</b>, <b>Export all</b>, <b>Manage math channels…</b> and <b>Combine " +
            "numbered tables into pages…</b>.</p>" +
            "<p>An exported histogram carries the math channels it depends on, so it works when someone else " +
            "imports it. Importing an HP Tuners layout recreates its histograms, folding numbered sets into one " +
            "paged table.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'math-channels',
      title: 'Math channels',
      summary: "Making a channel the log does not contain, and using it everywhere a real one works.",
      tags: ['math', 'expression', 'formula', 'calculated', 'function', 'trim'],
      sections: [
        {
          id: 'what', h: 'What they are ' + PRO,
          html:
            "<p>A math channel is a named formula over the channels in the log. Once defined it behaves like a " +
            "logged channel: it graphs, it drives a gauge, it fills histogram cells and it can be binned on an " +
            "axis.</p>" +
            "<p>Common ones: <code>Total Fuel Trim 1 = [Short Term Fuel Trim Bank 1] + [Long Term Fuel Trim " +
            "Bank 1]</code>, lambda error as a percentage, converter slip, a corrected load.</p>",
        },
        {
          id: 'writing', h: 'Writing an expression',
          html:
            "<ul>" +
            "<li>Reference a channel in <b>square brackets</b>: <code>[Engine RPM]</code>. Names match ignoring " +
            "case and spacing, and a bare multi-word name gets bracketed for you when you commit it.</li>" +
            "<li>Roles work too, so <code>[engine_rpm]</code> resolves on any log that has one.</li>" +
            "<li>Arithmetic is <code>+ &minus; * / ^</code> with brackets.</li>" +
            "<li>The <b>Functions</b> list in the editor shows everything available, with what each argument " +
            "means. Window functions such as an average over time take their window in milliseconds.</li>" +
            "<li>One math channel can reference another by name. A loop is detected and reported rather than " +
            "hanging.</li>" +
            "</ul>" +
            "<p>The line under the box tells you whether the expression is valid as you type, and where the " +
            "problem is when it is not.</p>",
        },
        {
          id: 'manager', h: 'The Math Channels manager',
          html:
            "<p>Open it from the histogram list menu: <b>Manage math channels…</b>. Each channel has a name, an " +
            "expression and a unit, and the unit is inferred from the channels you used if you leave it blank.</p>" +
            "<div class='hlp-note'>Use <b>Insert channel…</b> rather than typing a channel name. It brackets it " +
            "correctly and matches the log's exact spelling, which is the usual cause of an expression that " +
            "looks right and will not resolve.</div>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'smoothing',
      title: 'Smoothing and filtering',
      summary: "Three things with similar names. Which one you want, and what each actually changes.",
      tags: ['smoothing', 'filter', 'noise', 'average', 'window'],
      sections: [
        {
          id: 'smoothing', h: 'Smoothing a channel',
          html:
            "<p>The <b>&#8767;</b> button on a channel row applies a centred moving average over a window you " +
            "choose: <b>Off</b>, 50 ms, 100 ms, 150 ms, 250 ms, 500 ms, 1 s or 2 s. It takes the fuzz out of a " +
            "noisy sensor without changing anything underneath: the raw data is kept and comes back with " +
            "<b>Off</b>.</p>" +
            "<p>It applies to the graphs, the cursor readouts, the gauges, the statistics <i>and</i> the " +
            "histograms, so a table built on a smoothed channel bins the smoothed values. It is saved with a " +
            "layout, so a channel you always want smoothed stays that way.</p>",
        },
        {
          id: 'filtering', h: 'The two kinds of filtering',
          html:
            "<ul>" +
            "<li>A <b>histogram filter</b> decides which samples are counted at all: throttle above 50, coolant " +
            "above 170. Samples that fail are not in the table.</li>" +
            "<li><b>Filtering</b> in the estimated-acceleration settings is the width of the window used to " +
            "differentiate speed. Wider is smoother and slower to react.</li>" +
            "</ul>" +
            "<p>Smoothing changes how a value <i>reads</i>. A histogram filter changes what is <i>counted</i>. " +
            "Acceleration filtering changes how an estimate is <i>derived</i>.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'estimated-acceleration',
      title: 'Estimated acceleration',
      summary: "G, chassis speed and wheel slip worked out from a log with no accelerometer.",
      tags: ['acceleration', 'g', 'slip', 'spin', 'speed', 'calculated', 'dynamics'],
      sections: [
        {
          id: 'what', h: 'What you get',
          html:
            "<p>Most engine logs have no accelerometer. BigData estimates longitudinal acceleration from the " +
            "speed channels the log does have and adds a set of calculated channels: acceleration in G and in " +
            "other units, an estimated chassis speed, wheel slip, whether the wheels are spinning, and a " +
            "confidence figure. They carry the <b>&asymp;</b> badge and behave like any other channel.</p>",
        },
        {
          id: 'settings', h: 'Settings',
          html:
            "<p>The <b>&#9881;</b> on the channel row opens them:</p>" +
            "<ul>" +
            "<li><b>Speed source:</b> Auto, GPS, vehicle speed, wheel-speed fusion, or any speed channel it " +
            "found.</li>" +
            "<li><b>Filtering:</b> Auto, Fast (50 ms), Normal (150 ms), Smooth (250 ms) or Very smooth (500 ms).</li>" +
            "<li><b>Wheel spin correction:</b> Off, Auto or Aggressive.</li>" +
            "</ul>" +
            "<p>Underneath, read-only lines tell you which chassis speed was used, the window actually applied, " +
            "the sample rate and resolution of the source, and anything it decided not to use. Changing a " +
            "setting recalculates immediately.</p>" +
            "<div class='hlp-note'>The window is never allowed to be narrower than three samples. On a slow log " +
            "a very narrow setting would otherwise have nothing to work with and every G would read zero.</div>",
        },
        {
          id: 'trust', h: 'How far to trust it',
          html:
            "<p>It was validated against logs that also carried a real accelerometer and it tracks well on clean " +
            "pulls. It is still an estimate from wheel speed, so anything that makes wheel speed lie degrades " +
            "it: spin, a tyre size change, or a speed channel that updates slowly. The confidence channel and " +
            "the resolution line are there to tell you when that is happening.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'layouts',
      title: 'Layouts and saved gauges',
      summary: "What a layout remembers, how saving works, and how it follows your account.",
      tags: ['layout', 'save', 'sync', 'account', 'gauges', 'delete'],
      sections: [
        {
          id: 'what', h: 'What a layout holds',
          html:
            "<p>A layout is the whole working setup: which tab you were on, how many graphs, which channel is " +
            "on which graph, your smoothing, your histogram tables, the math channels they use, the gauges " +
            "behind them, and <b>which gauges were showing</b>, whether that was a built-in cluster or your own " +
            "dashboard.</p>" +
            "<p>So switching layouts switches the gauges with them. A Holley layout brings back its Holley " +
            "dashboard; a standard layout brings back the V8 cluster.</p>" +
            "<div class='hlp-note'>Layouts saved before version 0.1.37 carry no gauge choice yet. Load one, save " +
            "it again, and it will from then on.</div>",
        },
        {
          id: 'saving', h: 'Saving, updating and deleting',
          html:
            "<p>From the header's <b>Layout</b> menu:</p>" +
            "<ul>" +
            "<li><b>Save Layout</b> updates the one you have loaded, silently.</li>" +
            "<li><b>Save Layout As New…</b> asks for a name and makes another.</li>" +
            "<li><b>Save Custom Gauges</b> saves just the dashboard and the graph channels on screen with it. " +
            "Use a layout for a whole way of working, a gauge set for a cluster you want under several " +
            "layouts.</li>" +
            "<li><b>Delete this Layout</b> and <b>Delete these Custom Gauges</b> remove the loaded one; the " +
            "pickers also have a bin on every row.</li>" +
            "<li><b>&#8681; Download HPL</b> appears when the log came from your account, and downloads the " +
            "original file.</li>" +
            "</ul>" +
            "<p>Saving is free; syncing to your account is " + PRO + ". The picker button shows a <b>*</b> after " +
            "the name when you have unsaved changes.</p>",
        },
        {
          id: 'sync', h: 'They follow your account',
          html:
            "<p>The top of each picker says where they live: <b>Synced to &lt;your email&gt;</b>, or <b>This " +
            "device only</b> when you are not signed in or not Pro. Cloud layouts are re-pulled whenever you " +
            "open the picker, so a layout saved on another machine shows up without a restart.</p>" +
            "<div class='hlp-warn'>If a layout you expect is missing, check which account you are signed in to. " +
            "Layouts saved under one address do not appear under another.</div>" +
            "<p>The layout you used last comes back automatically on the next log you open.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'history',
      title: 'History',
      summary: "The list of logs you have opened, on this PC and across your devices.",
      tags: ['history', 'recent', 'account', 'sync', 'delete', 'storage'],
      sections: [
        {
          id: 'what', h: 'What is in the list',
          html:
            "<p>The panel on the home screen lists what you have opened. Rows marked <b>account</b> " + PRO +
            " are saved to AllDataLogs and open on any device you sign in to. Rows marked <b>this PC</b> are " +
            "files on this machine, and the list keeps the most recent twenty.</p>" +
            "<p>The switch at the top, <b>Save opened logs to my account</b>, turns the syncing off. With it " +
            "off, nothing leaves the machine.</p>" +
            "<p>The same log opened twice is stored once: files are matched by their content, not their name, " +
            "so a copy under a different name does not use your storage twice.</p>",
        },
        {
          id: 'delete', h: 'Removing things',
          html:
            "<table class='hlp-keys'><tbody>" +
            "<tr><td><b>&#128465;</b> on a this-PC row</td><td>Moves the file itself to the Recycle Bin, after " +
            "asking and showing you the full path. It is recoverable from there.</td></tr>" +
            "<tr><td><b>&#128465;</b> on an account row</td><td>Deletes the copy stored in your account, after " +
            "asking. Files on this PC are untouched.</td></tr>" +
            "<tr><td><b>&times;</b></td><td>Drops the row from the list and leaves the file alone. It comes back " +
            "next time you open that log.</td></tr>" +
            "</tbody></table>",
        },
        {
          id: 'quota', h: 'Storage',
          html:
            "<p>An account holds 1 GB of logs. When it fills, the automatically-saved logs you opened longest " +
            "ago are removed to make room. Logs you saved deliberately are never evicted, so a run you want to " +
            "keep should be saved rather than left to the automatic list.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'library',
      title: 'The library',
      summary: "Gauge dashboards and histograms shared between tuners.",
      tags: ['library', 'share', 'official', 'browse'],
      sections: [
        {
          id: 'browse', h: 'Browsing and using',
          html:
            "<p><b>Browse the library…</b> appears in the Custom Gauges picker and in the histogram list menu. " +
            "Browsing is free. Items are either <b>Official</b> or shared by another tuner, each with a " +
            "thumbnail, the car it was built for, and how many people have pulled it. <b>Use</b> " + PRO +
            " loads it into your session.</p>" +
            "<p>Shared dashboards bind by role wherever they can, so they still read correctly on a car whose " +
            "channels are named differently. A shared histogram carries the math channels it needs.</p>",
        },
        {
          id: 'share', h: 'Sharing yours',
          html:
            "<p><b>Share to library…</b> " + PRO + " is in the dashboard's <b>&ctdot;</b> menu and in a " +
            "histogram row's menu. Give it a name, a description and the car it suits. You can remove anything " +
            "you shared.</p>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'pro',
      title: 'Free and Pro',
      summary: "Exactly what a membership adds, what the apps require, and what happens when you are offline.",
      tags: ['pro', 'free', 'account', 'sign in', 'offline', 'licence', 'membership'],
      sections: [
        {
          id: 'split', h: 'What is in each',
          html:
            "<div class='hlp-warn'><b>The apps are Pro.</b> BigData for Windows and the phone apps need an " +
            "active membership to open a log. Anyone can download them; without a membership they show you how " +
            "to start one instead of opening the file. The <b>website</b> is where the free tier lives.</div>" +
            "<p><b>Free, in a browser, with no card:</b></p>" +
            "<ul>" +
            "<li>Open every supported format &mdash; HP Tuners .hpl, Holley .dl, MoTeC .ld, SCT, Haltech, " +
            "FuelTech, MegaSquirt and CSV &mdash; up to 15 MB a log.</li>" +
            "<li>Graphs with zoom, pan, a shared cursor and per-channel axis ranges.</li>" +
            "<li>The full channel list with live values, search and filters.</li>" +
            "<li>The built-in gauge clusters, and re-mapping any gauge to another channel.</li>" +
            "<li>Numeric cards with minimum, maximum and average.</li>" +
            "<li>Saving layouts and dashboards on the device you are using.</li>" +
            "<li>Browsing the shared library.</li>" +
            "</ul>" +
            "<p><b>Pro adds:</b></p>" +
            "<ul>" +
            "<li>Histogram tuning tables, math channels, and gauges behind a table.</li>" +
            "<li>Custom gauge dashboards you build and keep.</li>" +
            "<li>Comparing two logs on the same axes.</li>" +
            "<li>Race zero, time slips, lap times and Dragy data.</li>" +
            "<li>Using and sharing library items.</li>" +
            "<li>Layouts, dashboards and tables synced to every device you sign in to.</li>" +
            "<li>History of every log you open, saved to your account (1 GB).</li>" +
            "<li>Logs up to 250 MB.</li>" +
            "<li>BigData for Windows and the phone apps.</li>" +
            "</ul>" +
            "<p>Pro-locked controls stay visible rather than hidden, so you can see what a membership adds " +
            "before paying for one. Saving a layout is free; <i>syncing</i> it to your other devices is the " +
            "Pro part.</p>",
        },
        {
          id: 'activation', h: 'Signing in and staying signed in',
          html:
            "<p>Sign in once with your alldatalogs.com email and password. The app needs the internet that first " +
            "time to activate on this PC; after that it holds a signed statement of your membership and " +
            "re-checks in the background, when you come back from sleep, and when Windows says the network is " +
            "back.</p>" +
            "<p><b>Working offline is fine for 30 days at a stretch.</b> The banner tells you when it is " +
            "counting down: &ldquo;Offline. Pro stays active for N more days without a connection.&rdquo; " +
            "Reconnect and it renews silently. Past 30 days without a check, Pro features lock until you " +
            "reconnect; nothing is deleted.</p>" +
            "<p>A membership that is past due keeps working for a week rather than stopping dead, and one you " +
            "cancel runs to the end of the period you paid for.</p>",
        },
        {
          id: 'banners', h: 'What the banners mean',
          html:
            "<table class='hlp-keys'><tbody>" +
            "<tr><td>Offline, N days left</td><td>Normal. It is counting down the 30 days and will reset on the " +
            "next check.</td></tr>" +
            "<tr><td>Could not verify, N days left</td><td>It reached the server but could not confirm. Get " +
            "online properly, or check the membership on the website.</td></tr>" +
            "<tr><td>You were signed out on this PC</td><td>Sign in again.</td></tr>" +
            "<tr><td>This PC's clock moved backwards</td><td>Fix the date and time, then reconnect. Moving a " +
            "clock back is how an offline licence would be cheated, so it is treated carefully.</td></tr>" +
            "<tr><td>This version is too old to verify</td><td>Update the app.</td></tr>" +
            "</tbody></table>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'shortcuts',
      title: 'Keyboard and mouse',
      summary: "Every shortcut and gesture in one place.",
      tags: ['keyboard', 'shortcut', 'mouse', 'keys', 'gestures'],
      sections: [
        {
          id: 'keys', h: 'Keyboard',
          html:
            "<table class='hlp-keys'><thead><tr><th>Key</th><th>Where</th><th>What</th></tr></thead><tbody>" +
            "<tr><td><kbd>F1</kbd></td><td>Windows app</td><td>Open this manual.</td></tr>" +
            "<tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd></td><td>Anywhere in a log</td><td>Zoom the graphs in " +
            "and out around the cursor.</td></tr>" +
            "<tr><td><kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Anywhere in a log</td><td>Step the cursor one " +
            "sample.</td></tr>" +
            "<tr><td><kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Over a paged histogram</td><td>Previous and " +
            "next page.</td></tr>" +
            "<tr><td><kbd>Ctrl</kbd>+<kbd>C</kbd></td><td>Histogram table</td><td>Copy the selected cells.</td></tr>" +
            "<tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd></td><td>Histogram table</td><td>Copy with the " +
            "axis labels.</td></tr>" +
            "<tr><td><kbd>Ctrl</kbd>+<kbd>A</kbd></td><td>Histogram table</td><td>Select every cell.</td></tr>" +
            "<tr><td><kbd>Ctrl</kbd>+<kbd>V</kbd></td><td>Dash designer</td><td>Paste a copied gauge.</td></tr>" +
            "<tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Histogram editor</td><td>Save.</td></tr>" +
            "<tr><td><kbd>Esc</kbd></td><td>Anywhere</td><td>Close the menu, pop-over or dialog you are in. It " +
            "does not close the log.</td></tr>" +
            "</tbody></table>" +
            "<p>Arrow keys always belong to the text box you are typing in, so they never fight an editor.</p>",
        },
        {
          id: 'mouse', h: 'Mouse and touch',
          html:
            "<table class='hlp-keys'><tbody>" +
            "<tr><td>Drag a graph</td><td>Pan, including past either end of the log.</td></tr>" +
            "<tr><td>Wheel</td><td>Zoom around the pointer.</td></tr>" +
            "<tr><td>Shift + drag</td><td>Zoom into the span you drag out.</td></tr>" +
            "<tr><td>Right-click a graph</td><td>Race zero and per-channel Y-axis ranges.</td></tr>" +
            "<tr><td>Right-click a gauge</td><td>Its channel, range, warnings and colours. Works on a finalized " +
            "dashboard too.</td></tr>" +
            "<tr><td>Double-click a divider or legend</td><td>Reset it.</td></tr>" +
            "<tr><td>Drag a channel by <b>&equiv;</b></td><td>Reorder the list, or drop it on a graph panel.</td></tr>" +
            "<tr><td>Drag across histogram cells</td><td>Select a block. Shift-click extends, Ctrl-click adds " +
            "single cells, a header takes the row or column.</td></tr>" +
            "<tr><td>One finger on a touch screen</td><td>Moves the cursor. Two fingers pan and pinch.</td></tr>" +
            "</tbody></table>",
        },
      ],
    },

    // =============================================================================================
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      summary: "The things that go wrong most often, and the differences that look like bugs but are not.",
      tags: ['problem', 'error', 'missing', 'slow', 'help', 'wrong'],
      sections: [
        {
          id: 'missing-layout', h: 'My layout is not there',
          html:
            "<p>Almost always the wrong account. Layouts are per sign-in. Check the address at the top of the " +
            "picker: it says <b>Synced to &lt;email&gt;</b>, or <b>This device only</b> when you are signed out " +
            "or not Pro. Signing in with the other address brings them back.</p>",
        },
        {
          id: 'missing-parameter', h: 'A histogram says a parameter is missing',
          html:
            "<p>The table wants a channel this log does not have, or a math channel that was deleted. The panel " +
            "offers <b>Choose replacement…</b> with a dropdown per missing slot, so you can point it at a " +
            "channel from this log without rebuilding the table. If it names a math channel, check it still " +
            "exists in the Math Channels manager.</p>",
        },
        {
          id: 'gauges-blank', h: 'A gauge reads N/A',
          html:
            "<p>A dashboard built on another car is bound to channels this log does not have. Right-click the " +
            "gauge: if the role cannot be resolved the menu leads with <b>Not available in this log</b> and " +
            "offers channels to map it to instead.</p>",
        },
        {
          id: 'not-a-bug', h: 'Differences that are not bugs',
          html:
            "<ul>" +
            "<li><b>An HP Tuners channel reads differently than in VCM Scanner.</b> Scanner applies per-channel " +
            "display units from your tune, so a MAP channel stored in psi can show as inHg there. BigData " +
            "converts by quantity instead, and always shows US units.</li>" +
            "<li><b>An .hpl trace looks smoother than you expect.</b> HP Tuners logs are put on an even 25 Hz " +
            "grid so every channel shares one time base. A channel logged faster is reduced to that.</li>" +
            "<li><b>A Haltech channel looks like a staircase.</b> Haltech logs different channels at different " +
            "rates and the export repeats the last value between updates. That is how NSP draws them too.</li>" +
            "<li><b>SCT measured AFR looks like lambda.</b> Because it is. SCT names the channel AFR but logs " +
            "lambda, so it is treated as lambda rather than mis-scaled.</li>" +
            "<li><b>A Holley digital input has the wrong name.</b> Standard Holley channel names come from the " +
            "firmware layout; your configured analog inputs are read from the log, but some digital " +
            "input/output names still come from the reference layout. The values are right, the label may " +
            "not be.</li>" +
            "<li><b>A Holley .dl and its CSV export start at different times.</b> The .dl is zeroed at its " +
            "first sample; Holley's CSV keeps the negative pre-trigger time.</li>" +
            "</ul>",
        },
        {
          id: 'smartscreen', h: 'Windows blocked the installer',
          html:
            "<p>Expected while the app is in beta and not yet signed. Click <b>More info</b>, then <b>Run " +
            "anyway</b>. See <a href='#install-windows/smartscreen'>Installing</a>.</p>",
        },
        {
          id: 'slow', h: 'It feels slow on a huge log',
          html:
            "<p>Graphs draw from a reduced set of points, but histograms bin every sample, so a very long log " +
            "with several tables takes a moment on each change. Setting <b>Range</b> to <b>Selection</b> so a " +
            "table only bins what you are zoomed to, disabling tables you are not using, and raising <b>Min " +
            "Hits</b> all help.</p>",
        },
        {
          id: 'contact', h: 'Still stuck',
          html:
            "<p>Send the log and a line about what you expected to see. If a log fails to open for a Palm Beach " +
            "Dyno address it is uploaded automatically and looked at without you doing anything.</p>",
        },
      ],
    },
  ];

  // ===============================================================================================
  // Formats — one list, rendered into the Supported formats topic.
  // ===============================================================================================
  var FORMATS = [
    { tool: 'HP Tuners VCM Scanner', ext: '.hpl', direct: true,
      note: "Every container version we have met opens, including the older VCM Scanner format and the " +
            "header-less logs the TDN app writes. Channel names and units come from the file, or from a built-in " +
            "table of over 460 parameter ids when the file carries none." },
    { tool: 'HP Tuners (export)', ext: '.csv', direct: true,
      note: "Both of Scanner's CSV dialects open." },
    { tool: 'SCT Livewire / X4', ext: '.csv', direct: false,
      note: "Export a datalog CSV from the SCT software. Measured AFR in an SCT log is really lambda and is " +
            "treated as such. Ford torque-source codes are shown as text." },
    { tool: 'Haltech NSP', ext: '.csv', direct: false,
      note: "Export from NSP with File then Export. Values are scaled per channel type, temperatures come back " +
            "from kelvin, and the AFR channel is lambda." },
    { tool: 'FuelTech FT450 / 550 / 600', ext: '.csv', direct: false,
      note: "Export from FTManager. Time starts negative because of the pre-trigger, and the export is already " +
            "reduced compared with the native file." },
    { tool: 'Holley EFI', ext: '.dl', direct: true,
      note: "Opens directly. Your configured analog inputs are named from the log itself; a few digital " +
            "input and output names still come from the reference layout." },
    { tool: 'Holley EFI (export)', ext: '.csv', direct: true,
      note: "The Holley CSV export opens too, and keeps its negative pre-trigger time." },
    { tool: 'MoTeC i2 / M1', ext: '.ld', direct: true,
      note: "Opens directly, on an even 200 Hz time base. Units are the ones in the file, which can differ from " +
            "what i2 displays, because i2 keeps display units in the project rather than in the log." },
    { tool: 'MegaSquirt / TunerStudio', ext: '.msl', direct: true,
      note: "Text logs open directly. Units are whatever TunerStudio wrote." },
    { tool: 'Anything else', ext: '.csv', direct: true,
      note: "A comma-separated file with a first column called time or offset, and optionally a units row " +
            "underneath the names." },
  ];

  (function fillFormats() {
    var t = null, i;
    for (i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === 'formats') t = TOPICS[i];
    if (!t) return;
    var rows = FORMATS.map(function (f) {
      return "<tr><td><b>" + esc(f.tool) + "</b></td><td><code>" + esc(f.ext) + "</code></td><td>" +
        (f.direct ? "Opens directly" : "<b>Export first</b>") + "</td><td>" + f.note + "</td></tr>";
    }).join('');
    t.sections = [
      {
        id: 'table', h: 'What opens today',
        html:
          "<table class='hlp-keys hlp-formats'><thead><tr><th>Tool</th><th>File</th><th></th><th>Notes</th></tr></thead>" +
          "<tbody>" + rows + "</tbody></table>" +
          "<p>If your tool is not listed, export a CSV with a time column. That path works for almost " +
          "anything.</p>",
      },
      {
        id: 'exports', h: 'Files that have to be exported first',
        html:
          "<p>Some tools encrypt or pack their own log container, so nothing but that tool can read it. BigData " +
          "recognises these and tells you which export to make instead of failing vaguely:</p>" +
          "<table class='hlp-keys'><tbody>" +
          "<tr><td><b>Haltech <code>.hlg</code>, <code>.hlgzip</code></b></td><td>Encrypted by NSP. Export the " +
          "log as CSV from NSP, then open that.</td></tr>" +
          "<tr><td><b>Holley <code>.DLZ</code></b></td><td>A compressed download. Open it in the Holley " +
          "software and export a <code>.dl</code> or a CSV.</td></tr>" +
          "<tr><td><b>Binary MegaLogViewer <code>.mlg</code></b></td><td>Open it in MegaLogViewer or " +
          "TunerStudio and save it as a <code>.msl</code> text log.</td></tr>" +
          "<tr><td><b>FuelTech <code>.ftml</code></b></td><td>Not supported. Export a CSV from FTManager.</td></tr>" +
          "<tr><td><b>A very old <code>.hpl</code></b></td><td>Open it in a current VCM Scanner and re-save, or " +
          "export a CSV from Scanner.</td></tr>" +
          "</tbody></table>",
      },
      {
        id: 'units', h: 'Units and naming',
        html:
          "<p>Channels are matched to roles regardless of what the source tool calls them, which is how one " +
          "dashboard or one histogram works across brands.</p>" +
          "<p>Units are converted to US measures on the way in: Celsius to Fahrenheit, kPa, bar, mbar and inHg " +
          "to psi, km/h and m/s to mph, g/s and kg/h to lb/min, newton metres to pound feet. Units that are " +
          "already what a tuner expects are left alone, so Holley fuel flow stays lb/hr and HP Tuners injector " +
          "pulse width stays microseconds. A load channel logged as a ratio is shown as a percentage.</p>" +
          "<p>Where a log has manifold pressure and barometric pressure but no boost channel, a <b>Boost " +
          "(derived)</b> channel is added from the difference.</p>",
      },
    ];
  })();

  // ===============================================================================================
  // Reader
  // ===============================================================================================
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function textOf(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  function topicById(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return null;
  }

  /** Full-text search over titles, summaries, tags, headings and body text. Best match first. */
  function search(q) {
    var needle = String(q || '').toLowerCase().trim();
    if (!needle) return [];
    var words = needle.split(/\s+/);
    var out = [];
    TOPICS.forEach(function (t) {
      var meta = (t.title + ' ' + t.summary + ' ' + (t.tags || []).join(' ')).toLowerCase();
      var body = t.sections.map(function (s) { return s.h + ' ' + textOf(s.html); }).join(' ');
      var lower = body.toLowerCase();
      var score = 0, hit = null;
      words.forEach(function (w) {
        if (t.title.toLowerCase().indexOf(w) !== -1) score += 10;
        if (meta.indexOf(w) !== -1) score += 4;
        var at = lower.indexOf(w);
        if (at !== -1) { score += 2; if (hit == null) hit = at; }
      });
      if (!score) return;
      var snippet = t.summary;
      if (hit != null) {
        var start = Math.max(0, hit - 60);
        snippet = (start ? '…' : '') + body.slice(start, start + 170).trim() + '…';
      }
      out.push({ id: t.id, title: t.title, score: score, snippet: snippet });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  function changelogHtml() {
    var cl = global.DatalogChangelog;
    if (!cl || typeof cl.releases !== 'function') return '<p>No version history is available in this build.</p>';
    return cl.releases().map(function (r) {
      var items = (r.items || []).map(function (it) {
        return "<li><span class='hlp-cl-kind hlp-cl-" + esc(it.kind) + "'>" + esc(cl.kindLabel(it.kind)) + "</span> " + esc(it.text) + "</li>";
      }).join('');
      return "<section class='hlp-cl-rel'><h3>Version " + esc(r.version) + " <span class='hlp-cl-date'>" +
        esc(r.date) + "</span></h3><ul>" + items + "</ul></section>";
    }).join('');
  }

  function topicHtml(t) {
    var secs = t.sections.map(function (s) {
      return "<section class='hlp-sec' id='sec-" + esc(s.id) + "'><h2>" + s.h + "</h2>" + s.html + "</section>";
    }).join('');
    return "<article class='hlp-article' data-topic='" + esc(t.id) + "'>" +
      "<h1>" + esc(t.title) + "</h1><p class='hlp-summary'>" + esc(t.summary) + "</p>" + secs + "</article>";
  }

  /**
   * mount(host, opts) -> { show, destroy }
   *   opts.version   shown under the contents list, e.g. "0.1.38"
   *   opts.start     topic id to open first ('changelog' is valid)
   *   opts.onClose   when given, a Close button appears and Esc calls it
   *   opts.useHash   false to leave the address bar alone
   */
  function mount(host, opts) {
    opts = opts || {};
    if (!host) return null;
    var nav = TOPICS.map(function (t) {
      return "<button type='button' class='hlp-nav-item' data-go='" + esc(t.id) + "'>" + esc(t.title) + "</button>";
    }).join('');
    host.className = (host.className ? host.className + ' ' : '') + 'hlp';
    host.innerHTML =
      "<div class='hlp-side'>" +
        "<div class='hlp-brand'>BigData <span>Help</span></div>" +
        "<input type='search' class='hlp-search' placeholder='Search the manual…' autocomplete='off' spellcheck='false'>" +
        "<nav class='hlp-nav'>" + nav +
          "<div class='hlp-nav-sep'></div>" +
          "<button type='button' class='hlp-nav-item' data-go='changelog'>What is new</button>" +
        "</nav>" +
        "<div class='hlp-side-foot'>" + (opts.version ? 'BigData ' + esc(opts.version) : '') + "</div>" +
      "</div>" +
      "<div class='hlp-main'>" +
        (opts.onClose ? "<button type='button' class='hlp-close' title='Close (Esc)'>&times;</button>" : "") +
        "<div class='hlp-results' hidden></div>" +
        "<div class='hlp-body'></div>" +
      "</div>";

    var body = host.querySelector('.hlp-body');
    var results = host.querySelector('.hlp-results');
    var box = host.querySelector('.hlp-search');
    var main = host.querySelector('.hlp-main');

    function cssId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, ''); }

    function show(id, sectionId) {
      var t = topicById(id);
      results.hidden = true;
      if (id === 'changelog') {
        body.innerHTML = "<article class='hlp-article' data-topic='changelog'><h1>What is new</h1>" +
          "<p class='hlp-summary'>Every release, newest first.</p>" + changelogHtml() + "</article>";
      } else if (t) {
        body.innerHTML = topicHtml(t);
      } else return;
      Array.prototype.forEach.call(host.querySelectorAll('.hlp-nav-item'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-go') === id);
      });
      if (main) main.scrollTop = 0;
      if (sectionId) {
        var el = body.querySelector('#sec-' + cssId(sectionId));
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      }
      if (opts.useHash !== false) {
        try { global.history.replaceState(null, '', '#' + id + (sectionId ? '/' + sectionId : '')); } catch (e) { /* file:// */ }
      }
    }

    host.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (opts.onClose && t.closest('.hlp-close')) { opts.onClose(); return; }
      var go = t.closest('[data-go]');
      if (go) { show(go.getAttribute('data-go')); return; }
      var a = t.closest('a[href^="#"]');
      if (a) {
        e.preventDefault();
        var parts = a.getAttribute('href').slice(1).split('/');
        show(parts[0], parts[1]);
      }
    });

    var timer = null;
    box.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = box.value;
        if (!q.trim()) { results.hidden = true; return; }
        var hits = search(q);
        results.hidden = false;
        results.innerHTML = hits.length
          ? "<div class='hlp-results-head'>" + hits.length + ' result' + (hits.length === 1 ? '' : 's') + ' for “' + esc(q) + '”</div>' +
            hits.map(function (h) {
              return "<button type='button' class='hlp-result' data-go='" + esc(h.id) + "'><b>" + esc(h.title) +
                "</b><span>" + esc(h.snippet) + "</span></button>";
            }).join('')
          : "<div class='hlp-results-head'>Nothing matches “" + esc(q) + "”. Try a word from the screen you are looking at.</div>";
      }, 120);
    });

    var startId = opts.start || 'getting-started', startSec = null;
    try {
      var h = ((global.location && global.location.hash) || '').replace(/^#/, '');
      if (h) { var p = h.split('/'); if (topicById(p[0]) || p[0] === 'changelog') { startId = p[0]; startSec = p[1]; } }
    } catch (e) { /* ignore */ }
    show(startId, startSec);

    function onKey(e) {
      if (e.key === 'Escape' && opts.onClose) { e.preventDefault(); opts.onClose(); }
      else if (e.key === '/' && document.activeElement !== box) { e.preventDefault(); box.focus(); box.select(); }
    }
    document.addEventListener('keydown', onKey);

    return {
      show: show,
      destroy: function () { document.removeEventListener('keydown', onKey); host.innerHTML = ''; },
    };
  }

  var API = {
    VERSION: 'help@1.0.0',
    topics: function () { return TOPICS.slice(); },
    topic: topicById,
    formats: function () { return FORMATS.slice(); },
    search: search,
    topicHtml: topicHtml,
    changelogHtml: changelogHtml,
    mount: mount,
  };

  global.DatalogHelp = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
