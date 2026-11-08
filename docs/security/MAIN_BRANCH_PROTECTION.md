# Protecting the MES STORE default branch

This repository was observed with the default branch unprotected. This document is the owner-applied configuration; a code change alone cannot enable GitHub repository rules.

## Required rules for `main`

1. Require a pull request before merging. Do not allow direct pushes.
2. Require the latest push to be approved by at least one reviewer when a second maintainer is available. A PR author cannot approve their own PR.
3. Dismiss stale approvals after new commits and require conversation resolution.
4. Require these status checks from the latest commit:
   - `MES STORE CI`
   - `Store and Garment Motion Checks`
   - `Dependency Review` (only after the repository Dependency Graph is enabled and this check passes).
5. Require branches to be up to date before merging.
6. Block force pushes and branch deletion. Require linear history if the team's merge strategy supports it.
7. Restrict bypass to a minimal, documented emergency-maintainer set. Do not grant broad bypass to GitHub Actions.
8. Keep the GitHub Pages deployment workflow restricted to the default branch. Merging to `main` deploys the static storefront.

## Owner setup

Open **Settings → Rules → Rulesets → New branch ruleset** (or Settings → Branches → Add branch protection rule), target `main`, and apply the rules above. Enable **Dependency graph** under **Settings → Security → Advanced Security** before requiring Dependency Review.

## Verification boundary

The GitHub integration used for this implementation could inspect repository files and CI but did not have permission to read or change branch-protection settings (GitHub returned 403). No protection rule is claimed as enabled. After the owner applies the rules, verify the ruleset is active and run a test PR to confirm required checks are enforced.
