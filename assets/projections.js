/*
 * Generated from the supplied NFL_Season_Projections__OFF_.csv attachment.
 * The source contains 108 rows limited to position(s): QB.
 */
(function () {
  const players = [
    {"id":"jordanlove","name":"Jordan Love","position":"QB","passAttempts":540.5,"passYards":4085.6,"passTouchdowns":28.5,"interceptions":10.9,"rushAttempts":49.8,"rushYards":208.8,"rushTouchdowns":0.6,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":3.2},
    {"id":"lamarjackson","name":"Lamar Jackson","position":"QB","passAttempts":450.3,"passYards":3682.6,"passTouchdowns":28.9,"interceptions":9.9,"rushAttempts":118.7,"rushYards":645.7,"rushTouchdowns":3.3,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":4.2},
    {"id":"jaydendaniels","name":"Jayden Daniels","position":"QB","passAttempts":472.1,"passYards":3515.1,"passTouchdowns":23.1,"interceptions":10.5,"rushAttempts":125.2,"rushYards":658.3,"rushTouchdowns":4.6,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":2.7},
    {"id":"jaredgoff","name":"Jared Goff","position":"QB","passAttempts":574.5,"passYards":4524.8,"passTouchdowns":33.4,"interceptions":10.6,"rushAttempts":25.2,"rushYards":50.7,"rushTouchdowns":0.3,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":3.9},
    {"id":"drakemaye","name":"Drake Maye","position":"QB","passAttempts":498.6,"passYards":4012.3,"passTouchdowns":27.9,"interceptions":10.5,"rushAttempts":99.8,"rushYards":508.9,"rushTouchdowns":3.7,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":5.5},
    {"id":"calebwilliams","name":"Caleb Williams","position":"QB","passAttempts":600.9,"passYards":4150.5,"passTouchdowns":29.8,"interceptions":10.3,"rushAttempts":84.4,"rushYards":430,"rushTouchdowns":2.3,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":3.3},
    {"id":"joshallen","name":"Josh Allen","position":"QB","passAttempts":493.3,"passYards":3815.2,"passTouchdowns":27.6,"interceptions":11.5,"rushAttempts":118.8,"rushYards":587.8,"rushTouchdowns":11.8,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":4.1},
    {"id":"brockpurdy","name":"Brock Purdy","position":"QB","passAttempts":503.3,"passYards":3827.8,"passTouchdowns":25.9,"interceptions":13.4,"rushAttempts":66,"rushYards":284.1,"rushTouchdowns":3.7,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":4},
    {"id":"joeburrow","name":"Joe Burrow","position":"QB","passAttempts":595.6,"passYards":4207.6,"passTouchdowns":33.6,"interceptions":11.9,"rushAttempts":47.1,"rushYards":180.1,"rushTouchdowns":1.4,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":1.9},
    {"id":"cjstroud","name":"C.J. Stroud","position":"QB","passAttempts":565.6,"passYards":3976.1,"passTouchdowns":24.3,"interceptions":11.8,"rushAttempts":56,"rushYards":246.6,"rushTouchdowns":1,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":3.6},
    {"id":"jaxsondart","name":"Jaxson Dart","position":"QB","passAttempts":504.2,"passYards":3560.9,"passTouchdowns":22.7,"interceptions":11.2,"rushAttempts":99.7,"rushYards":542.3,"rushTouchdowns":6.5,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":2.9},
    {"id":"tylershough","name":"Tyler Shough","position":"QB","passAttempts":519.7,"passYards":3717.1,"passTouchdowns":20.7,"interceptions":11.1,"rushAttempts":71.2,"rushYards":302,"rushTouchdowns":3.9,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":3.4},
    {"id":"bonix","name":"Bo Nix","position":"QB","passAttempts":559.3,"passYards":3728.3,"passTouchdowns":26.8,"interceptions":10.9,"rushAttempts":78.7,"rushYards":338.2,"rushTouchdowns":3.6,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":2},
    {"id":"jalenhurts","name":"Jalen Hurts","position":"QB","passAttempts":487.3,"passYards":3572.7,"passTouchdowns":24.4,"interceptions":7.5,"rushAttempts":111.9,"rushYards":462,"rushTouchdowns":8.6,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":4},
    {"id":"dakprescott","name":"Dak Prescott","position":"QB","passAttempts":571.8,"passYards":4207.8,"passTouchdowns":30.4,"interceptions":11.2,"rushAttempts":48.6,"rushYards":171.5,"rushTouchdowns":1.8,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":2.7},
    {"id":"trevorlawrence","name":"Trevor Lawrence","position":"QB","passAttempts":548.1,"passYards":3900.9,"passTouchdowns":26.9,"interceptions":13.3,"rushAttempts":73.5,"rushYards":324.8,"rushTouchdowns":5,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":3.4},
    {"id":"justinherbert","name":"Justin Herbert","position":"QB","passAttempts":537.3,"passYards":3905.4,"passTouchdowns":26.8,"interceptions":12,"rushAttempts":80.3,"rushYards":470.7,"rushTouchdowns":2.2,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":2.9},
    {"id":"matthewstafford","name":"Matthew Stafford","position":"QB","passAttempts":556.7,"passYards":4256,"passTouchdowns":34.7,"interceptions":8.7,"rushAttempts":25.1,"rushYards":35.3,"rushTouchdowns":0.2,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":2.8},
    {"id":"patrickmahomes","name":"Patrick Mahomes","position":"QB","passAttempts":538.7,"passYards":3716.5,"passTouchdowns":26.6,"interceptions":11.3,"rushAttempts":59,"rushYards":354.3,"rushTouchdowns":3.4,"receptions":0,"receivingYards":0,"receivingTouchdowns":0,"fumbles":1.9}
  ];

  window.DRAFT_COMPASS_PROJECTIONS = {
    meta: {
      sourceName: "Supplied NFL offensive projections CSV",
      sourceFileTimestamp: "2026-08-03T17:03:32.6250774Z",
      sourceRecordCount: 108,
      sourcePositions: ["QB"],
      matchedBoardRecordCount: 19,
      scoringLimitation: "The supplied file has no first-down fields or game-level yardage splits, so first-down and 100/150/200-yard bonus points are excluded."
    },
    players: Object.fromEntries(players.map((player) => [player.id, player]))
  };
}());
