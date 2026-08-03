# Dungeon Online v3

## Local Ranked Test Launcher (Windows)

Double-click [Launch-Local-Ranked-Test.cmd](Launch-Local-Ranked-Test.cmd) from a
Windows checkout to open the local Ranked test window.

The launcher excludes its own branch, then chooses the newest remaining local
branch by commit date. It shows the newest five commits from that branch; pick
one row before starting. It never consults remote branches.

The first start for a selected commit can take a little longer because the
launcher's isolated worktree may need to install that revision's Worker
dependencies. Later starts reuse that local checkout and state.

To test the Observer Bot, tick **Observer Bot (local test)** and keep or edit
the displayed throwaway password. In the game choose **Start + Observer Bot**,
enter the same password, then use `F10` to toggle the bot after unlock.

Every session uses a fresh loopback URL, a local Worker, and local D1 state. It
has no deploy, tunnel, remote-preview, or public-leaderboard publishing path.
**Stop** terminates only the session started by this launcher. It intentionally
keeps the selected local cache and state for later testing.
