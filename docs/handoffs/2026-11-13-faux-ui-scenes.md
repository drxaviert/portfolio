# Handoff: faux-UI scenes — Loop is the decision (2026-11-13)
Dat approved Window, Phone and Tiles in Loop for the featured card; Still stays only as the reduced-motion fallback, kept as a panel toggle so it can be checked.
Route: `/dev/proto/faux-ui` (dev only). Deep links `?scene=window|phone|tiles&mode=loop|still&theme=day|night`; an absent `?mode=` opens Loop, an absent `?scene=` opens Window.
Commits: `0f5e94e` prototype, `9d7764a` offscreen pause + uniform scaling + calmer one-motion loops; this commit records the Loop decision.
To log in `docs/design-system/motion.md` after the scenes are integrated:
| Scene | Duration | Property | Easing | Rest |
| --- | --- | --- | --- | --- |
| Window | 8000ms | cursor transform + opacity; press scale 0.97 | entrance cubic-bezier(0.23,1,0.32,1), exit ease-in, settle cubic-bezier(0.34,1.3,0.64,1) | ~65% |
| Phone | 7800ms | highlight transform + opacity | entrance cubic-bezier(0.23,1,0.32,1), exit ease-in | 64% |
| Tiles | 8200ms | bars transform (scaleY) | entrance cubic-bezier(0.23,1,0.32,1), exit ease-in | 74% |
Open item for the work-drawer lead: which scene goes on which featured card.
