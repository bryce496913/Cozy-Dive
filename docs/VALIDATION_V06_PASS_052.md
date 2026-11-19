# v0.6 Pass 052: play-test fixes (`0.6.0-rc.13`)

Changes from the user's play-test of the outer reef, kelp forest, sea cave and under the ice.

**No tests or checks were run in this pass, at the user's request.** Typecheck, lint, unit tests, build and browser harnesses are all to be run at the next full run-through. The unit tests that assert the changed values were updated where known (build pieces, the bumphead parrotfish label); others may need updating then.

## Outer reef

| Feedback                                                                                                                    | Change                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bring the turtles onto the reef, not in the blue                                                                            | Both turtle loops moved from beyond the back glass (z −63.5) to low over the reef top inside the tank (`OuterCreatures.ts`).                                                                                                                                                                                                                                            |
| Bannerfish half the size, double the number; spread out until the sunfish comes up, then pull together before it is visible | 24 bannerfish at 0.28 m (were 12 at 0.55 m). While waiting, pairs spread 2.6 m apart along the glass at varied heights. The sunfish now starts up from the deep (out of sight, to −28 m) while they gather. They are schooled at the station before it rises into view (`reefEncounters.ts`).                                                                           |
| Bumphead twice the size                                                                                                     | The bumphead parrotfish (the heavy, blunt-headed model) is drawn at 2.2 m (was 1.1 m), hovers higher over the coral, and shies a little sooner. Its name is now "Bumphead parrotfish".                                                                                                                                                                                  |
| Fewer passes for the whale and whale shark                                                                                  | Their near lanes are unchanged. They now turn far out and come back well beyond sight, so each loop shows one pass instead of two, and loops take about 40% longer (`WallVisitors.ts`).                                                                                                                                                                                 |
| Bigeyes closer to the glass                                                                                                 | The trevally ball circles 5 m beyond the glass (was 9.5 m), with about a metre of water between its edge and the glass.                                                                                                                                                                                                                                                 |
| Octopus floating; jumped back to its cave; the cave is broken                                                               | The octopus walks on the seabed, not over coral tops or rock hoods, which had lifted it into mid water. It visits the foot of each rock, and eases into and out of its pace, with no step at its den. Its den is a new solid rock mound with a deep dark pocket and boulders seated on it (`OctopusDen.ts`), replacing the open shell. The cave's octopus benefits too. |

## Kelp forest

| Feedback                          | Change                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| Seal can be bigger                | Harbour seal drawn at 1.5× (about 2.4 m).                              |
| Otter needs to be better designed | A new sea otter model (`tools/art/pass052/otter.py`), described below. |

The new otter:

- **Body:** chunky, with a broad squarish head and a neck.
- **Face:** whisker pads and whiskers, a dark nose, small ears and eyes.
- **Paws and feet:** stubby forearms with paws, and big webbed five-toed hind feet.
- **Tail:** a thick, flat tail.
- **Fur:** dark brown and streaked, with a grizzled cream head and chest.

## Sea cave

| Feedback                                                | Change                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Weird square texture at the entrance                    | The cave's square sand sheet reached past the wall. At the entrance its edge stood above the tunnel's floor. Beyond the wall it now drops out of sight.                                                                                                |
| Crabs need more detail                                  | The crabs are rebuilt with much more detail, described below the table.                                                                                                                                                                                |
| The moray eel and the cave are broken                   | The moray's crack was the lobsters' thin open hood, hung on the wall and floating above the sand with gaps. It is now a solid rock outcrop rising from the sand into the wall, with a deep dark crack at the moray's head; the outcrop hides its body. |
| Lionfish needs more detail                              | The lionfish is rebuilt with much more detail, described below the table.                                                                                                                                                                              |
| The zebra shark needs to be scared away like the others | The nurse shark now startles and bolts too. It slips out from under its ledge before rising, settles on open sand away from the swimmer, and swims home once they have been gone a while.                                                              |
| Better scared-shark animation                           | `SharkBolt` gives every startled shark three stages, described below the table.                                                                                                                                                                        |
| Tunnel to the ice needs better design                   | The tunnel is redesigned, described below the table.                                                                                                                                                                                                   |

**The crabs:**

- **Shell:** a sculpted, mottled carapace with a toothed front edge, raised regions and a pale underside.
- **Face:** glossy eyes on stalks, antennae and mouthparts.
- **Claws:** an arm, a wrist and a swollen palm, with two toothed fingers tipped dark.
- **Legs:** three-segment legs with joints and pointed tips.

**The lionfish:**

- **Body:** a real fish profile with alternating broad and fine bands that run through the eye.
- **Head:** a big-lipped mouth, ringed eyes, banded tentacles and tabs.
- **Fins:** spotted, see-through soft fins; 13 dorsal spines and 8-ray pectoral fans (were 8 and 6), finely banded with wider membranes.

**The startled sharks (`SharkBolt`):**

1. **Flinch:** a C-start, with a hard body bend and a snap turn away.
2. **Dash:** it drives forward along its heading (never sideways), bursting to speed, banking and nosing up as it climbs.
3. **Settle:** it eases to calm beats and glides down to rest.

**The tunnel to the ice:**

- **Mouth:** boulders heaped round it.
- **Frost:** blue-white frost creeps over the rock towards the ice.
- **Icicles:** they hang in the tunnel's colder half.

## Under the ice

| Feedback                                   | Change                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The entrance needs to be fixed             | The entrance is rebuilt, described below the table.                                                                                                                                                                                                         |
| There are no creatures                     | The models load correctly (checked against the registry). The life was there, but almost all of it was up at the sea ice (about 6 m above where you can swim) or tiny, and the rare visitors waited one to two minutes. Changes are listed below the table. |
| A lot more life, creatures and environment | A new `IceExtras` module, listed below the table.                                                                                                                                                                                                           |
| Everything needs more detail               | Icebergs have more facets and real ice structure in their colours, listed below the table.                                                                                                                                                                  |

**The entrance under the ice:**

- **The rock wall:** it faced away from the waters under the ice, so from inside it wasn't drawn and the outside of the tunnel showed through. It now faces in, and is frosted higher up.
- **The tunnel's end cap:** it now faces back down the tunnel.
- **The mouth:** frosted boulders are heaped round it, icicles hang over it, and the tunnel's last stretch is frosted with icicles.

**More creatures where you swim:**

- **Penguins:** 6 emperor penguins diving every 10 to 26 s (were 2, every 35 to 80 s), and 8 Adélie penguins swimming lower down (were 4).
- **The Weddell seal:** it hangs 5.5 m under the ice (was 3 m).
- **Fish on and under the ice:** 12 icefish and 24 notothens (were 6 and 14).
- **Rare visitors:** the first comes after 25 to 55 s (was 70 to 140 s), and they come more often.
- **The garden:** much denser (sponges 110, soft corals 120, anemones 90, sea stars 110, feather stars 50).
- **A new mid-water school:** 110 Antarctic silverfish.

**The new `IceExtras` module:**

- **The sea ice:** brinicles hang from it, and a layer of platelet ice lies beneath it.
- **The seabed:**
  - dropstones and anchor ice;
  - Antarctic scallop beds, some clapping;
  - red sea urchins, brittle stars, sea cucumbers and swaying sea pens;
  - giant isopods crawling.
- **Mid water:** 7 big Antarctic jellyfish, pulsing, with frilled arms and long tentacles, and 8 drifting salp chains.
- **Sightings:** there are new sightings for each.

**More detailed icebergs:**

- **Layers:** deep blue compressed-ice layers and dark dirt bands in the basal ice.
- **Surface:** pale melt flutes, and rime under the sea ice.

## Not yet done

- **Checks:** all tests and checks, at the user's request (see the top of this record).
- **Screenshots and performance:** none taken. The ice now draws much more: about 20 more instanced draws, 7 jellyfish and a 110-fish school, so it needs measuring.
- **The "bumphead":** read as the bumphead parrotfish. If the humphead wrasse was meant, that is a one-line change.
