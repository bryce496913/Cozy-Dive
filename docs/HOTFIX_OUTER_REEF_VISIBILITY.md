# Outer reef visibility hotfix

The outer reef's distant scenery was still visible when detail levels or draw limits changed. Increase exponential fog density from 0.06 to 0.13, reaching approximately 96% haze at 14 m, and deepen the shallow blue horizon and surface colors for an open-ocean mood.

Reduce the camera range from 150 m to 25 m (initially 48 m, then shortened by request), rock/massive-coral draw limits from 32 m to 24 m, plate/plant limits from 16 m to 14 m and debris from 12 m to 10 m. Backdrop instances now stop at 32 m, with extra room for their larger footprints. Close detail thresholds stay at their existing distances. The depth-darkening ocean dome continues to fill the background at the far plane.

Testing, builds, typechecks and lint were not run, as explicitly requested for this hotfix. Formatting only. Visual acceptance and pop-in assessment remain for the user's play-through.
