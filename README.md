# Attribute Label

Adds text labels to a 2D map: built from a feature's attributes, or free text. Labels are plain `TextSymbol`
graphics on the **Draw** widget's layer, so they sit with other drawings. They are edited, moved and deleted in
this widget, because Draw's text panel resets the text when the style changes.

## Installation

ArcGIS Experience Builder Developer Edition 1.21.

1. Copy this folder to `client/your-extensions/widgets/attribute-label`.
2. Restart the client dev server (`npm start` in `client/`).
3. Add the widget to an experience in the builder.

## Using the widget

Choose everything first, then click the map.

1. **From layer** or **Free text** (tabs at the top). The settings below them are in a collapsible section
   (*Layer and fields* or *Text*) that shows a summary when closed and opens again when a tab is clicked.
   - *From layer*: pick a layer (every visible layer that can be labelled, map image sublayers included), tick
     fields (they appear in the order ticked; sample values come from a feature of the layer), choose how to
     join them and whether to show field names, and where to **Place at**: the feature's centre (inside the
     polygon, on the line) or where you click.
   - *Free text*: type the text. Enter adds a line.
2. **Label style** (collapsible): font, size, B / I / U, colour, halo, background, alignment, angle. Closed, it
   shows a one-line summary and an "Aa" sample. **+ Save style** keeps the current style as a named chip;
   click a chip to apply it. Reset returns to the builder's default.
3. **Start placing**. Each click adds a label straight away; the message that follows has **Undo**, and
   Ctrl+Z (Cmd+Z) undoes adds, deletes, Clear all, moves and edits while the widget is open; Ctrl+Y or
   Ctrl+Shift+Z redoes them (last 50 steps). A banner on
   the map shows the mode; **Stop** or Esc ends it. A feature that already has a label from this widget is not
   labelled twice, unless *Several labels per feature* is on; then the extra label goes where you click.

**[Map Context Menu](https://github.com/mhoyland/map-context-menu-widget)** (2.1.0+): *Add label here* labels the feature at the right-click with the current
settings; *Add text here* places the free text there. Both open the widget.

## Labels on the map

A collapsible list of the labels added in this session. Hovering a row outlines that label on the map.

- **Edit**: the text and full style, loaded from the label as it is now and shown live. Save keeps it; Cancel
  or Esc puts it back. Ctrl+Enter saves.
- **Zoom to**, **Delete**.
- **Move**: drag labels on the map, one after another. Dragging elsewhere still pans. *Done* or Esc ends it.
  The grab area is estimated from the text size, so it is approximate for unusual fonts.
- **Clear all**, with Undo.

## Saving with [Save Experience State](https://github.com/mhoyland/save-experience-state-widget)

Each label carries attributes (`alSource: 'attribute-label'`, `alKind`, `alKey`) that survive saving. When
Save Experience State restores a state, the labels come back on Draw's layer (or its holding layer if Draw
hasn't been opened) and this widget lists them again, so they can be edited, moved and deleted as before. The
"already labelled" check still works, because `alKey` is the labelled feature. Undo/Redo history is cleared
on a restore, because it refers to the labels that were replaced.

With *Include text drawn with Draw* on, text made with Draw's text tool is listed too and can be edited here.

Save Experience State also saves labels waiting in this widget's holding layer (`attribute-label-<widgetId>`)
before Draw has been opened; that needs Save Experience State 1.21.1 or later.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Map | — | The Map widget to label. |
| Place labels at | Feature centre | Starting value; people can change it in the widget. |
| Join fields with | New line | Starting value. |
| Several labels per feature | off | A feature that already has a label gets another where the map is clicked. |
| Show field names | off | Starting value. |
| Include text drawn with Draw | on | Lists Draw's own text so it can be edited here. |
| Default label style | Arial 12 pt, black, white 1 pt halo | Reset style in the widget returns to this. |
| Remember choices | on | Keeps the last tab, layer, fields, text, placement and style in the browser. Saved styles are always kept. The remembered layer is kept even if it is turned off or out of scale when the app opens (shown as *(not visible)*). |
| Click tolerance | 6 px | Search box around the click for point and line layers. Polygons use the point itself. |

Fonts are the Esri hosted fonts with regular, bold, italic and bold italic: Arial, Avenir Next LT Pro, BellTopo
Sans, Alegreya and Josefin Slab. A label restyled in Draw with another hosted font keeps it.

## Draw widget

The Draw widget adds its layer (`jimu-draw-layer-<mapViewId>-…` inside `jimu-draw-groupLayer-…`) the first time
it opens, and only tracks layers it created itself. When that layer exists, labels go into it. Before that they
go into a hidden "Labels" layer owned by this widget and are moved across when Draw's layer appears. If Draw is
closed and unmounted, its layer and the labels in it go with it.

## Limitations

- 2D maps only (`TextSymbol` does not draw in a SceneView).
- Labels are not saved with the app; a page reload clears them.
