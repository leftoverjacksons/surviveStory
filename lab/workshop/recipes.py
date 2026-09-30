"""
Characters as recipes: a build, the game's pool (man | woman | child), one part
per slot (parts.py), and colours by colour slot. This is the data the game
would decide for each survivor at run time (role, clothes, equipment); here it
is written by hand from the user's concept art (concepts/).
"""

RECIPES = {
    # concepts/folk_scout.webp (turnaround) and concepts/folk_scout_ingame.png (in-game look)
    'folk_scout': dict(
        build='hero', pool='man',
        parts={'body': 'body.base', 'head': 'head.face', 'hair': 'hair.curly', 'top': 'top.tunic',
               'bottom': 'bottom.baggy', 'legs': 'legs.wraps', 'feet': 'feet.boots', 'hands': 'hands.gloves_fingerless',
               'neck': 'neck.scarf', 'waist': 'waist.belt', 'straps': 'straps.chest', 'bag': 'bag.satchel',
               'back': 'back.bedroll', 'outer': 'outer.cloak', 'held': 'held.lantern'},
        palette={'skin': '#b27a50', 'hair': '#241a14', 'cloth_tunic': '#cdbb92', 'cloth_trousers': '#4a403b',
                 'cloth_cloak': '#7c9656', 'cloth_cloak_edge': '#a8a466', 'cloth_scarf': '#d4836a'},
    ),
    # concepts/gardener_ingame.png
    'gardener': dict(
        build='hero', pool='woman',
        parts={'body': 'body.base', 'head': 'head.face', 'hair': 'hair.bun', 'top': 'top.shirt_rolled',
               'bottom': 'bottom.overalls', 'feet': 'feet.boots', 'hands': 'hands.gloves_fingerless',
               'neck': 'neck.bandana', 'bag': 'bag.plant_sack', 'held': 'held.trowel'},
        palette={'skin': '#d9a57c', 'hair': '#1c1a22', 'hat_band': '#d8c070', 'cloth_shirt': '#e2d3ad',
                 'cloth_denim': '#3e5a7e', 'cloth_bandana': '#6f7f3a', 'strap_glove': '#4a4a48', 'boot': '#7a5234'},
    ),
}
