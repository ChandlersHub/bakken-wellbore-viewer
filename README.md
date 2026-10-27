# Bakken Wellbore Viewer

A local interactive 3D viewer for public North Dakota well surveys and production data. The goal is to make the Bakken's well geometry and production history easier to explore visually.

## Features

- Orbit, pan, zoom to a selected well, and switch between plan, side and 3D views.
- North Dakota boundary and city references for geographic orientation.
- Well-section classification, including candidates for sustained sideways deviation in the upper well.
- Azimuth, inclination, DLS, curvature, local tortuosity, signed build/turn rates, TVD, measured depth and horizontal departure.
- Independent color ranges by well section, with custom limits.
- Operator colors, a searchable operator identity, an operator filter, and a fit-to-filter button. Production totals follow the operator filter.
- Monthly oil playback with lateral display width proportional to the square root of monthly barrels.
- DSU and township lateral-footage scenarios with Turbo colors, editable low/base/high densities, and retained September results for comparison.
- Gamma-ray and conventional CBL amplitude overlays on observed vertical survey branches.
- Local canvas recording studios for the cluster showcase and statewide tour.

## Source snapshot and local data

This repository contains application and processing code, the vendored Three.js library with its license, and the geographic reference layer. It does not contain the full survey dataset, production records, LAS files, extracted log catalogs/indexes, caches or videos. Cloning the source alone does not restore the populated viewer.

The current working installation contains 48,929 survey branches and 5,495,609 stations. Those are dataset counts, not files distributed in this repository. Keep the existing local installation and original inputs as the data backup.

## Setup

Install Python dependencies:

```sh
python -m pip install -r requirements.txt
```

To restore the current installation, copy its prepared `full-dataset/` into this directory, its `viewer/data/sample/` and `viewer/data/showcase/` into `viewer/data/`, and its generated log catalogs and survey index into `gamma-data/`. These paths are ignored by Git.

Configure `BAKKEN_LAS_DIR`, `BAKKEN_MANIFEST` and `BAKKEN_SURVEY_DBF` to your original LAS directory, prepared full-dataset manifest and OGD survey DBF. Defaults are `local-data/las`, `full-dataset/manifest.json` and `local-data/OGD_Horizontals.dbf` under this repository. Catalog source paths must also match the local files. This snapshot preserves the working implementation; it is not a one-click portable installer.

Run the full local server once those inputs are configured:

```sh
python serve.py
```

It binds to `127.0.0.1` and prints the viewer URL. Add `--no-browser` to suppress opening a tab, or `--port 65119` to request a particular local port.

For geometry/production only, without the optional log service, serve this folder with Python's static server:

```sh
python -m http.server 65119 --bind 127.0.0.1
```

Then open `http://127.0.0.1:65119/viewer/?dataset=full`. Prepared data is still required; GR/CBL API routes are unavailable on the static server.

## Marketing site and lead capture

`site/` is a static landing page for customer acquisition: positioning, the Founder Pilot offer, early-access pricing, a demo/pilot request form and the data limitations. It is plain HTML/ES modules and can be hosted on any static host next to `viewer/`. Locally, `python serve.py` also serves it at `/site/`, or use the static server above and open `http://127.0.0.1:65119/site/`.

Edit `site/config.js` before publishing:

- `leadEndpoint`: URL that accepts the request as a JSON POST (a form service or your own API). When empty, the form opens a prefilled email to `contactEmail`; when both are empty it reports that requests are not configured.
- `plausibleDomain`: enables Plausible analytics. Funnel events (`CTA Click`, `Lead Submitted`, `Lead Failed`, `Share View`) are also dispatched as `bakken:track` DOM events for any other tool.
- `plans`, `plannedPlans`, `snapshot`: prices are experiments and coverage counts follow each data refresh, so they live in config rather than markup.
- `explorerUrl`: the Free Explorer entry; a hosted copy must include `viewer/data/showcase/`.

Requests carry first-touch `utm_*`/`ref` attribution so lead-to-demo can be measured by channel. The viewer header adds **Request a pilot** (target set by the `bakken:pilot-url` meta tag in `viewer/index.html`) and **Share view**, which copies a link restoring the color mode, footage inventory scenario and selected DSU.

```sh
node tests/site-lead.mjs
node tests/share-url.mjs
```

## Preparing survey data

The local data was refreshed from the [ND DMR GIS downloads](https://gis.dmr.nd.gov/gisdownload.asp) dated October 17, 2026. The refreshed local survey contains 48,929 branches, 22,498 permit/API10 wells and 5,495,609 retained stations. Download `OGD_Wells.zip` for reported operators and `OGD_Horizontals.zip` for station geometry. Prepared data remains local.

```sh
python prepare_data.py INPUT.dbf full-dataset --tvd-sign positive --source-crs NAD83
python prepare_metrics.py INPUT.dbf full-dataset full-dataset
python prepare_section_scales.py full-dataset full-dataset
```

Choose the TVD sign and CRS to match the input. The first command requires a new output folder. `prepare_production.py --help` describes the production import arguments. Original input files are not modified.

For an existing installation, `prepare_data.py --origin LONGITUDE LATITUDE` preserves its tangent-plane origin when rebuilding geometry. Quote full-precision coordinate strings in PowerShell. Keep all metric, production and log indexes aligned with the new manifest; the local log server must restart after its survey index changes.

Add operator metadata after preparing a survey dataset:

```sh
python prepare_operators.py OGD_Wells.dbf full-dataset --source-date 2026-10-17
```

Choose **Operator** under **Color wellbores by**, then optionally filter a display group and select **Fit displayed operators**. The palette follows the supplied operator legend: Hess/Chevron is green and XTO is amber. Chord/Enerplus/Oasis/Whiting and other combined legend entries are display groups. Selecting a well shows its exact reported DMR operator name. These aliases do not assert legal ownership or reconstruct the operator in a historical production month. Unlisted operators remain individually named with stable colors; unavailable identities are gray. Joins use permit plus API10; mismatches and ambiguous identities are not guessed.

To share an operator-view URL on your local instance, use `/viewer/?dataset=full&color=operator`.

## Operator validation

```sh
python -m unittest discover -s tests -v
node tests/operator-colors.mjs
```

The checks cover strict DBF joins, ambiguous/mismatched identities, palette groups, invalid metadata, per-segment and selected-branch coloring, production ribbon color sharing, operator-filter production totals, and switching datasets without retaining old operator mappings.

## Interpretation

TVD is relative to each well's reference, not a shared elevation datum. Section labels and drillback candidates are geometric classifications. Curvature is DLS expressed in different units. Tortuosity uses a centered, up-to-1,000-ft measured-depth window; planned curves also increase it. Section-specific colors compare variation within a section, not identical values between sections.

Production playback retains the current survey geometry through time. Display widths and log tubes are illustrative, not physical bore diameters. GR/CBL measurements retain their source units; no formation identity, calibration, hydraulic isolation or cement-quality grade is inferred.

## Video routes

- `/viewer/?showcase=cluster`: 35-second cluster showcase.
- `/viewer/?showcase=tour`: 50-second statewide zoom and feature tour.

Both need the prepared showcase subset. The statewide tour additionally needs the full overview and the configured local GR/CBL sources. Recordings are generated and downloaded locally.

## Drilling spacing units (DSUs)

Enable **Show 3D DSU boxes** to load the local DSU layer. The boxes follow the
published footprint polygons, including irregular and overlapping units. They
occupy an **approximate Lodgepole–Three Forks display interval** near the laterals;
they are not columns from the surface and are not a legal interpretation of orders.
Use **Inspect DSUs instead of wells** to pick a box, choose among overlapping
records, zoom to it, or show only that DSU. Turn inspection off to select wells.
Upper/lower offsets shift the estimated boundaries in feet. The normal depth-scale
slider exaggerates wells and DSU boxes together without changing physical TVD.

The local October 17, 2026 snapshot contains 10,573 source records. Fixed acreage colors follow Bakken Forward: 1,280 green, 1,920 blue, 2,560 orange,
3,840 purple, 640 teal and 5,120 pink. Other sizes are gray. A continuous acreage
scale and spacing/drilling type remain available.
Optional saved Bakken Forward colors use a **September 12, 2026 screening model**
based on September 7 GIS. Only 759 current records have eligible exact matches;
413 matches require review and 9,401 records are unmatched. Gray means unavailable,
never zero. This historical model has not been recalculated for October data.
Its saved assumptions are 8 wells/1,280 acres, 2-mile laterals, $70 oil, 13 days/well,
and $8.5 million/well. Development is a modeled percentage; confidence is a score,
not a probability. No DSU operator ownership is inferred.

Depth placement uses converted TVD picks dated September 7: nearby same-well
Lodgepole/Birdbear pairs are preferred (up to five within 25 km). Birdbear top is an
approximate proxy for the Three Forks base. Other units use screened separate
top medians, Lodgepole +800 ft, or nearest long-lateral TVD −800/+200 ft. A regional
9,000–10,000 ft fallback exists when no control is available. All depths use the
existing provisional KB/relative-TVD convention with no reference-elevation
correction. This is an illustration, not a fitted or verified formation surface.
The inspector reports the method, control count, distances and date. Formation
surfaces and exact order-defined limits can replace these estimates later.

Generated DSU data, formation picks and historical model files remain local and
are ignored by Git. Copy `viewer/data/dsu/` when moving the populated installation.
To prepare fresh public footprints without GIS dependencies:

```sh
python prepare_dsu.py OGD_DrillingSpacingUnits.zip local-data/dsus.geojson
```

For approximate depths, supply the existing resolved converted-TVD picks CSV
(FileNo, formation_code, tvd_ft, easting_m, northing_m, top_md_ft, status,
survey_gap_ft and datum/reference fields). Source XY is EPSG:32121 metres;
`--coordinates source` requires pyproj. `--coordinates manifest` uses matching
VERT-branch bounding-box centers as approximate locations and records that choice.

```sh
python prepare_dsu_zone.py --dsus local-data/dsus.geojson --manifest full-dataset/manifest.json --tops local-data/converted-tops.csv --output local-data/dsu-zones.json
python merge_dsu_zones.py local-data/dsus.geojson local-data/dsu-zones.json viewer/data/dsu/drilling-spacing-units.geojson
```

Create the output folder before merging. Without formation picks, the viewer
can load the footprint-only output at that same path and explicitly uses the
regional approximate interval. The public ZIP has no depths or inventory fields.
Historical inventory colors require a separately audited exact-identity join;
the raw importer does not invent those estimates.

Source: [ND DMR public GIS downloads](https://gis.dmr.nd.gov/gisdownload.asp).
Geology context: [NDGS Three Forks](https://www.dmr.nd.gov/dmr/ndgs/three-forks).

### Nested overlap display

The default **Nested outlines** view keeps centers open and uses Bakken Forward's
fixed inward display offsets: 640 acres = 0 ft, 1,280 = 100 ft, 1,920 = 220 ft,
2,560 = 340 ft, 3,840 = 460 ft, 5,120 = 580 ft. Intermediate sizes interpolate;
larger units use a logarithmic extension. Fifty-foot perimeter bands are computed
with mitred negative buffers in EPSG:5070, then returned to NAD83. They are display
symbols, not setbacks or lease-line corridors. Source polygons, published acres,
inventory estimates and original depth intervals remain unchanged. Offsets depend
on nominal acreage, so filtering does not move them. If any component is too narrow
for a band, the entire record falls back to its original unfilled outline.

**Optional depth separation** starts off. It provides an exploded view by lifting
larger acreage classes above smaller ones, at the chosen feet per level; the
inspector reports each display lift separately. Well paths and estimated zone
depths do not change. **Source footprint boxes** restores the original boundaries
and disables the display lift. Selection uses full source footprints with the
same display lift and still exposes overlapping records independently.

To regenerate the display geometry, install optional Shapely and pyproj, then:

```sh
python prepare_dsu_display.py local-data/dsus-with-zones.geojson viewer/data/dsu/drilling-spacing-units.geojson
```

The helper preserves all source geometry/properties and adds separate display
geometry, provenance, containment checks and an audit. It requires NAD83 input.
The current local snapshot has 10,572 nested-band records and one original-outline
fallback. Generated geometry remains local.

### Select a DSU: wells and combined monthly production

Enable **Inspect DSUs instead of wells** and click a box, choose an overlapping
record, or use the DSU search. The associated well paths are highlighted in cyan;
other paths dim. Production ribbons on the selected group retain full opacity.
The sidebar shows whole-well combined monthly oil, coverage, reported period
volume and a well list. **Play group production** uses the existing monthly
timeline. Clear the DSU selection or hide the layer to restore the operator scope.
Operator filters intersect both the highlighted group and its production totals.
A direct link accepts `?dataset=full&dsu=STABLE_DSU_ID`.

Membership uses exact XY clipping of classified section-4 lateral segments against
the original source footprint. It unions exact shared/retraced linework within
each permit/API10 well, excludes point-only touches and unsupported MD gaps over
1,000 ft, and retains every well branch for highlighting. Display insets and
depth separation never affect membership. This is geometric association, not
legal assignment, completion attribution, ownership or a verified bench match.
The default rule requires 660 ft of lateral inside; users can choose any positive
length or at least half of the well's supported lateral length. This threshold
is an inspection choice, not a regulatory setback or drainage assumption.

Monthly volumes count each matching physical well once across its branches. They
are whole-well reported oil across pools, not prorated by clipped path length.
Missing reports are not zero; partial months are marked in the group chart.
Overlapping DSU group totals must not be summed as exclusive allocations. Available
production still ends in December 2024. The index validates the current full
survey's manifest SHA256 and branch identities; other datasets require a rebuild.

Prepare the optional association index with `requirements-dsu.txt` installed:

```sh
python prepare_dsu_membership.py viewer/data/dsu/drilling-spacing-units.geojson full-dataset viewer/data/dsu/dsu-well-membership.json
node tests/dsu-production.mjs
```

The Python helper requires prepared station tiles and aligned MD metrics. The
generated index/audit stays in ignored `viewer/data/dsu/`. Synthetic Node tests
need no external data; optional prepared data can be checked with `--data PATH`.

### Inventory methodology review

The September scenario is retained as a legacy model under review, not a current
validated count of remaining drillable wells. An October 17 local audit examines
overlap allocation versus engineering capacity, exclusive well assignments,
geometry-fingerprint reproducibility, well-count versus length-equivalent measures,
unknown benches and validation requirements. The populated installation includes
`viewer/inventory-review.html`; detailed retained-model audit outputs stay local
and are not published in this source repository.

The footage comparison described below uses PLSS township land accounting and
within-well lateral union. Explicit development layouts and persistent candidate
corridor IDs across overlapping DSU alternatives remain future work. Township
aggregation uses a township-clipped spatial ledger rather than summing DSU estimates;
inspect reported township gaps and overlaps before summing regional totals.
No calibrated capacity, feasible-location count or development probability is claimed.

### Lateral-footage scenarios: DSUs and townships

Enable **Show footage scenarios** under **Lateral footage inventory**. Choose
DSUs or townships, a low/base/high capacity scenario, and surveyed lateral feet,
development percentage or scenario feet remaining. Enable **Inspect DSUs instead
of wells** to click DSUs; township inspection starts enabled. Selecting a unit shows
all three scenarios. The DSU inspector retains **Compare September 12 results**; historical
values are not overwritten. Township search and **Zoom to township** aid navigation.
Use `/viewer/?dataset=full&inventory=township&scenario=base` for the township view.

The editable defaults are **49.5 / 66 / 82.5 ft per acre**. Base translates the
historical eight two-mile wells per 1,280 acres into footage; low/high are ±25%
illustrations. These are comparison assumptions, not calibrated development limits.
The method measures classified survey lateral plan footage, not verified completed
intervals. Capacity and footage use the same original DSU footprint or the same
DSU-covered township portion. Overlapping DSUs must not be summed.

Turbo colors use 0–100% for development and a layer-wide P98 cap for feet.
Footage color endpoints stay fixed across scenario switches; DSUs and townships
have separate ranges. Values above the color cap remain visible numerically.
Gray means unavailable. The all-operator inventory calculation is independent
of well display filters.

Copy the prepared installation's `viewer/data/inventory/` alongside its matching
`viewer/data/dsu/` and `full-dataset/` when moving computers. All remain ignored
by Git. A mismatched or absent snapshot is reported as unavailable. For a fresh
build, install `requirements-footage.txt` and follow
[the footage method and preparation instructions](docs/footage-inventory.md).

Source-only validation (no external datasets):

```sh
node tests/footage-model.mjs
node tests/footage-controller.mjs
python -m unittest discover -s tests -p "test_prepare_footage.py" -v
```
