/*
 * datalog-changelog.js — the release history people can read, in one place.
 *
 * Shipped with the engine, so the Windows app's What's New window and the website's changelog page
 * render the SAME list from the SAME file. Newest first. Every entry is written for a tuner, not for
 * a developer: what changed on screen, not which function moved.
 *
 *   version   the BigData for Windows version the change shipped in. The website and the phone apps
 *             ride the same engine, so their behaviour changes on the same date.
 *   date      ISO date it was published.
 *   items     { kind: 'new' | 'fix' | 'change', text }
 *
 * ADDING AN ENTRY: put it at the TOP of RELEASES, use the version the release script just tagged, and
 * keep each item to one sentence a customer would understand. Anything invisible to a user belongs in
 * the commit message, not here.
 */
(function (global) {
  'use strict';

  var RELEASES = [
    {
      version: '1.0.3', date: '2026-09-11', items: [
        { kind: 'change', text: 'BigData for Windows is now digitally signed. The installer and the app show K2 Research & Development LLC as a verified publisher instead of an unknown one. On a brand-new certificate the Windows SmartScreen screen can still appear for a while and fades as more people install it.' },
      ],
    },
    {
      version: '1.0.2', date: '2026-09-11', items: [
        { kind: 'fix', text: 'The docked legend column never shows a scrollbar. When a graph is short the text steps down and busy graphs pair the tiles or switch to a compact list, and long names are abbreviated word by word instead of being cut off at the end: Estimated Acceleration reads EST ACCEL. Values are sized for the widest number each channel can show, so scrubbing never pushes one off its tile.' },
        { kind: 'change', text: 'The calculated channels have short names everywhere: EST ACCEL, EST SPEED, WHEEL SLIP, WHEEL SPIN and the rest.' },
      ],
    },
    {
      version: '1.0.1', date: '2026-09-11', items: [
        { kind: 'change', text: 'BigData for Windows now wears the real BigData logo: the connector and pulse mark is the app icon on the taskbar, the Start menu, the title bar and the installer, and the full logo heads the sign-in and home screens.' },
        { kind: 'change', text: 'The graph legends now start docked to the left of the graphs. Drag one out onto a graph to float them, as before, and that choice is remembered.' },
      ],
    },
    {
      version: '1.0.0', date: '2026-09-11', items: [
        { kind: 'new', text: 'The graph legends can dock to the left of the graphs the way HP Tuners shows them: drag a legend to the left edge of its graph and every graph gets a column showing the name and unit of each channel over a large value in its colour. Drag one back onto a graph to float them again.' },
        { kind: 'change', text: 'All the graphs dock together, so their time axes stay lined up and the cursor stays one straight line down them. The choice is remembered and saved with a Layout.' },
      ],
    },
    {
      version: '0.1.46', date: '2026-09-11', items: [
        { kind: 'new', text: 'The readout under the graphs now shows the log time at the cursor whenever no race zero is set, in larger numbers than the race time used. Setting a zero switches it to race time, as before.' },
        { kind: 'fix', text: 'The time readout keeps one width for the whole log, so the zoom bar beside it no longer shifts as the numbers change, a minus sign appears, or you set and clear the race zero.' },
        { kind: 'change', text: 'The zoom bar under the graphs is 10% taller.' },
      ],
    },
    {
      version: '0.1.45', date: '2026-09-11', items: [
        { kind: 'fix', text: 'On a log with hundreds of channels the channel list now draws only the rows you can see, so moving the cursor costs about the same on a 524-channel log as on a small one: a cursor frame with every live value went from about fifty milliseconds to about five, and rebuilding the list from twenty-five to under ten.' },
        { kind: 'change', text: 'Because the list is that cheap now, the live values keep up with the cursor on every frame again on big logs, rather than being paced to spare the machine.' },
        { kind: 'fix', text: 'On phones the channel list now shows its Favorites, Logged channels, Math channels and Calculated headings. They arrived in 0.1.41 but a phone-only layout rule was hiding them.' },
      ],
    },
    {
      version: '0.1.44', date: '2026-09-10', items: [
        { kind: 'fix', text: 'The cursor line now has its own layer over each graph, so moving it no longer redraws the traces. On a big log with four graphs that alone was about forty milliseconds a frame; the line itself is now under a fifth of a millisecond and keeps up with the pointer, and it stays welded to the data while you drag a graph.' },
        { kind: 'fix', text: 'The live values in the channel list are only refreshed for the rows on screen, and on a log with hundreds of channels they refresh about eighteen times a second instead of fighting the cursor for every frame. They always settle on the exact value once the pointer stops, and a normal-sized log still updates them every frame.' },
      ],
    },
    {
      version: '0.1.43', date: '2026-09-10', items: [
        { kind: 'fix', text: 'Moving the mouse over a graph is far lighter on the machine. Every mouse position used to rebuild all of the graphs from scratch, hundreds of times a second on a fast mouse; the crosshair and the readouts now update once per screen refresh and only repaint, which took the work behind one mouse move from about twenty milliseconds to under one.' },
        { kind: 'fix', text: 'Dragging the overview bar under the graphs got the same treatment, so a long drag no longer stacks up a redraw for every position the mouse reported.' },
      ],
    },
    {
      version: '0.1.42', date: '2026-09-10', items: [
        { kind: 'fix', text: 'The fourth graph is now offered on the Graph tab. The button was there only in a graph view you could reach from the old view picker, so the tab itself still stopped at three.' },
      ],
    },
    {
      version: '0.1.41', date: '2026-09-10', items: [
        { kind: 'new', text: 'Every channel in the list now has a star. Star one and it moves to a Favorites section at the top, and it stays starred on every log you open afterwards.' },
        { kind: 'new', text: 'The channel list is divided into Logged channels, Math channels and Calculated, each heading foldable and each showing its count. The app remembers which sections you folded, and searching always opens them so a match can never hide behind a folded heading.' },
        { kind: 'fix', text: 'Ticking a channel no longer throws the channel list back to the top \u2014 it stays where you were, and so does assigning one to a graph.' },
        { kind: 'fix', text: 'Adding a gauge to a saved dashboard no longer stops one of the gauges already on it from reading. A dashboard already saved with that fault is repaired the next time you open it.' },
      ],
    },
    {
      version: '0.1.40', date: '2026-09-10', items: [
        { kind: 'change', text: 'The manual now spells out exactly what Free and Pro include, and states plainly that the Windows and phone apps need an active Pro membership to open a log. The website says the same on its pricing and download pages.' },
      ],
    },
    {
      version: '0.1.39', date: '2026-09-10', items: [
        { kind: 'new', text: 'A complete manual is built into the app. Press F1, or use the Help menu, and it opens in its own window: eighteen topics with a contents list and a search box that searches the whole text, and it works offline.' },
        { kind: 'new', text: 'This version history is in the app too, under Help then What is new, and on the website.' },
        { kind: 'new', text: 'The same manual is published on alldatalogs.com/help, and the Windows app now has a download page at alldatalogs.com/download.' },
      ],
    },
    {
      version: '0.1.38', date: '2026-09-10', items: [
        { kind: 'fix', text: 'The Layout button and menu now name the layout you are actually using. Saving a layout makes it the one that comes back on your next log, and a layout that had not finished loading from your account is retried instead of forgotten.' },
        { kind: 'fix', text: 'The Layout menu no longer ticks a built-in gauge view while your own custom dash is on screen.' },
        { kind: 'fix', text: 'The Layout menu no longer jumps to the left edge of the window when the saved-layout list refreshes while it is open.' },
      ],
    },
    {
      version: '0.1.37', date: '2026-09-10', items: [
        { kind: 'new', text: 'A layout now remembers which gauges you were looking at. Switch layouts and the gauges switch with them, whether that is your own dash or a built-in gauge view.' },
        { kind: 'new', text: 'Graph View can show four graphs instead of three. The fourth is added above the bottom graph, so channels you already placed stay where you put them.' },
      ],
    },
    {
      version: '0.1.36', date: '2026-09-10', items: [
        { kind: 'new', text: 'History rows have delete buttons: the bin moves the file to the Recycle Bin or removes the copy saved in your account, the cross just drops the row from the list.' },
        { kind: 'fix', text: 'MegaSquirt logs are labelled MegaSquirt in History instead of CSV.' },
      ],
    },
    {
      version: '0.1.35', date: '2026-09-09', items: [
        { kind: 'new', text: 'The graph can be dragged past either end of the log, so a run that ends at the finish line can be pulled into the clear instead of sitting against the edge. The empty part is marked "log end".' },
      ],
    },
    {
      version: '0.1.34', date: '2026-09-09', items: [
        { kind: 'fix', text: 'Gauges placed behind a histogram now lay out around the table: beside it when they fit, otherwise below it, so a wide table stops covering them.' },
      ],
    },
    {
      version: '0.1.33', date: '2026-09-09', items: [
        { kind: 'fix', text: 'The Math Channels manager keeps a channel inserted from the "Insert channel…" list. It used to show it and then lose it, so the formula reopened with the last term missing.' },
        { kind: 'fix', text: 'The Functions buttons in the Math Channels manager insert again.' },
      ],
    },
    {
      version: '0.1.32', date: '2026-09-09', items: [
        { kind: 'new', text: 'History syncs to your account. Every log you open is saved once, listed newest first on every device you sign in to, and re-opened by clicking it. A switch in the History panel turns it off.' },
      ],
    },
    {
      version: '0.1.31', date: '2026-09-09', items: [
        { kind: 'new', text: 'Paged histograms work over math channels, so one table can page through Total Fuel Trim 1, 2, 3… the way it pages through mapped points.' },
      ],
    },
    {
      version: '0.1.30', date: '2026-09-09', items: [
        { kind: 'change', text: 'The viewer header stays open in the Windows app instead of hiding until you reach for it.' },
      ],
    },
    {
      version: '0.1.29', date: '2026-09-09', items: [
        { kind: 'new', text: 'HP Tuners .hpl files saved by VCM Scanner in the older container (versions 6 and 8) open, with real channel names and units.' },
        { kind: 'fix', text: 'More v7 .hpl logs decode: wider channel ids and 16-bit tags are handled.' },
      ],
    },
    {
      version: '0.1.28', date: '2026-09-09', items: [
        { kind: 'fix', text: 'Estimated acceleration no longer reads zero on a slow log. A filtering window narrower than three samples is widened to three.' },
      ],
    },
    {
      version: '0.1.27', date: '2026-09-09', items: [
        { kind: 'new', text: 'TDN .hpl logs with no file header open.' },
        { kind: 'fix', text: 'Changing a channel\'s filtering keeps it on the graph instead of removing it.' },
        { kind: 'new', text: 'The last custom dash you used comes back on the next log, and switching from the default gauges to custom returns to it instead of the builder.' },
      ],
    },
    {
      version: '0.1.26', date: '2026-09-09', items: [
        { kind: 'fix', text: 'The per-row tools on a channel are no longer pushed off by a long channel name.' },
        { kind: 'new', text: 'Filter buttons under the channel search box show only logged parameters, math channels or calculated channels.' },
      ],
    },
    {
      version: '0.1.25', date: '2026-09-09', items: [
        { kind: 'new', text: 'Per-channel smoothing: set a time window on any channel and the trace smooths without changing the underlying data.' },
        { kind: 'new', text: 'A saved gauge set remembers the graph channels that were on screen with it.' },
        { kind: 'change', text: 'The last layout you used comes back on the next log.' },
      ],
    },
    {
      version: '0.1.24', date: '2026-09-09', items: [
        { kind: 'new', text: 'Estimated acceleration: G, chassis speed, wheel slip and spin detection calculated from the log, with a settings button on the channel row.' },
      ],
    },
    {
      version: '0.1.23', date: '2026-09-09', items: [
        { kind: 'fix', text: 'Ford torque-source codes on SCT logs read as text instead of numbers.' },
      ],
    },
    {
      version: '0.1.22', date: '2026-09-09', items: [
        { kind: 'new', text: 'MegaSquirt and TunerStudio text logs (.msl and text .mlg) open natively.' },
      ],
    },
    {
      version: '0.1.21', date: '2026-09-09', items: [
        { kind: 'fix', text: 'Saved layouts are kept per account, and the picker shows which account they are synced to. Layouts saved under one sign-in stopped appearing under the other.' },
      ],
    },
    { version: '0.1.20', date: '2026-09-09', items: [{ kind: 'change', text: 'Internal improvements.' }] },
    {
      version: '0.1.19', date: '2026-09-09', items: [
        { kind: 'fix', text: 'Scorecard: closing the throttle at wide-open is no longer marked down on EcoBoost engines, where the blade is used for boost and torque control.' },
      ],
    },
    {
      version: '0.1.18', date: '2026-09-09', items: [
        { kind: 'new', text: 'Scorecard scores all ten categories from the log, with engine type and fuel pulldowns and clickable evidence that jumps to the moment in the log.' },
      ],
    },
    {
      version: '0.1.17', date: '2026-09-09', items: [
        { kind: 'new', text: 'Table gauge: a label-and-value list for source and status fields, with names for numeric state codes.' },
      ],
    },
    {
      version: '0.1.16', date: '2026-09-09', items: [
        { kind: 'new', text: 'Gauges can be placed behind the histogram table, built with the same designer as a custom dash.' },
      ],
    },
    {
      version: '0.1.15', date: '2026-09-08', items: [
        { kind: 'new', text: 'The owner map on a paged histogram can be judged by weight, samples, total value, peak or which page was active.' },
      ],
    },
    {
      version: '0.1.14', date: '2026-09-08', items: [
        { kind: 'fix', text: 'The live dot on a histogram follows a converted axis, so a table binned in inHg tracks correctly on a log in psi.' },
      ],
    },
    {
      version: '0.1.13', date: '2026-09-08', items: [
        { kind: 'new', text: 'Weighted-average histograms, and an owner map showing which page dominates each cell.' },
      ],
    },
    {
      version: '0.1.12', date: '2026-09-08', items: [
        { kind: 'new', text: 'Paged histograms: one table with arrows instead of one table per mapped point.' },
      ],
    },
    { version: '0.1.11', date: '2026-09-08', items: [{ kind: 'fix', text: 'Narrow bar gauges keep their scale numbers.' }] },
    { version: '0.1.10', date: '2026-09-08', items: [{ kind: 'fix', text: 'Bar gauge numbers no longer overlap the bar.' }] },
    {
      version: '0.1.9', date: '2026-09-08', items: [
        { kind: 'new', text: 'Haltech logs open through the CSV that NSP exports.' },
      ],
    },
    { version: '0.1.8', date: '2026-09-08', items: [{ kind: 'change', text: 'Smaller names and tick numbers on custom dash gauges, so more fits on screen.' }] },
    {
      version: '0.1.7', date: '2026-09-08', items: [
        { kind: 'new', text: 'Copy, duplicate and paste gauges in the dash designer.' },
      ],
    },
    { version: '0.1.6', date: '2026-09-08', items: [{ kind: 'fix', text: 'Recent files are kept per account, so two sign-ins on one PC no longer see each other\'s logs.' }] },
    {
      version: '0.1.5', date: '2026-09-08', items: [
        { kind: 'new', text: 'The shared library can be updated in place, marked as official, and filtered by car.' },
      ],
    },
    {
      version: '0.1.4', date: '2026-09-08', items: [
        { kind: 'new', text: 'The shared library of gauge dashboards and histograms is available in the Windows app.' },
      ],
    },
    {
      version: '0.1.3', date: '2026-09-08', items: [
        { kind: 'fix', text: 'Histograms that reference a math channel resolve it after loading a layout, instead of reporting a missing parameter.' },
      ],
    },
    { version: '0.1.2', date: '2026-09-07', items: [{ kind: 'fix', text: 'Restart now finishes an update without leaving a wizard waiting for a click.' }] },
    { version: '0.1.1', date: '2026-09-07', items: [{ kind: 'fix', text: 'Releases publish reliably, so Check for updates always finds the new version.' }] },
    {
      version: '0.1.0', date: '2026-09-07', items: [
        { kind: 'new', text: 'First release of BigData for Windows: the full viewer as a desktop app, with file associations, drag and drop, automatic updates, and layouts that sync to your account.' },
      ],
    },
  ];

  var KIND_LABEL = { 'new': 'New', fix: 'Fixed', change: 'Changed' };

  var API = {
    VERSION: 'changelog@1.0.0',
    releases: function () { return RELEASES.slice(); },
    latest: function () { return RELEASES[0] || null; },
    /** The releases newer than `version` — what a person gets by updating. */
    since: function (version) {
      var out = [];
      for (var i = 0; i < RELEASES.length; i++) {
        if (cmp(RELEASES[i].version, version) <= 0) break;
        out.push(RELEASES[i]);
      }
      return out;
    },
    kindLabel: function (k) { return KIND_LABEL[k] || 'Changed'; },
    compare: cmp,
  };

  /** Semantic-ish compare: 0.1.10 is newer than 0.1.9. */
  function cmp(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  global.DatalogChangelog = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
