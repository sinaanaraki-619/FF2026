/*
 * Local seed data. Values are intentionally marked as illustrative until replaced
 * with an imported current rankings/ADP export; see README.md and data/source-schema.json.
 */
(function () {
  const players = [
    ["ja-marr-chase", "Ja'Marr Chase", "WR", "CIN", 1.7, 2.1, 2.2, 2.0],
    ["bijan-robinson", "Bijan Robinson", "RB", "ATL", 2.8, 3.2, 3.0, 3.1],
    ["justin-jefferson", "Justin Jefferson", "WR", "MIN", 3.7, 4.0, 3.8, 4.2],
    ["jahmyr-gibbs", "Jahmyr Gibbs", "RB", "DET", 4.9, 5.4, 5.0, 5.5],
    ["ceedee-lamb", "CeeDee Lamb", "WR", "DAL", 5.8, 6.3, 6.0, 6.4],
    ["amon-ra-st-brown", "Amon-Ra St. Brown", "WR", "DET", 7.4, 7.9, 7.6, 8.1],
    ["saquon-barkley", "Saquon Barkley", "RB", "PHI", 8.5, 9.0, 8.7, 9.2],
    ["puka-nacua", "Puka Nacua", "WR", "LAR", 9.8, 10.4, 10.1, 10.5],
    ["christian-mccaffrey", "Christian McCaffrey", "RB", "SF", 10.6, 11.3, 10.8, 11.4],
    ["malik-nabers", "Malik Nabers", "WR", "NYG", 12.2, 12.7, 12.4, 12.9],
    ["ashton-jeanty", "Ashton Jeanty", "RB", "LV", 13.5, 14.2, 13.9, 14.4],
    ["brian-thomas-jr", "Brian Thomas Jr.", "WR", "JAX", 14.7, 15.4, 15.0, 15.5],
    ["nico-collins", "Nico Collins", "WR", "HOU", 16.1, 16.8, 16.4, 17.0],
    ["derrick-henry", "Derrick Henry", "RB", "BAL", 17.5, 18.3, 17.9, 18.5],
    ["drake-london", "Drake London", "WR", "ATL", 18.9, 19.7, 19.2, 19.9],
    ["bucky-irving", "Bucky Irving", "RB", "TB", 20.4, 21.0, 20.8, 21.2],
    ["de-von-achane", "De'Von Achane", "RB", "MIA", 22.0, 22.8, 22.4, 23.0],
    ["aj-brown", "A.J. Brown", "WR", "PHI", 23.5, 24.2, 23.8, 24.5],
    ["josh-jacobs", "Josh Jacobs", "RB", "GB", 25.0, 25.8, 25.5, 26.0],
    ["chase-brown", "Chase Brown", "RB", "CIN", 26.6, 27.4, 27.0, 27.6],
    ["jonathan-taylor", "Jonathan Taylor", "RB", "IND", 28.1, 29.0, 28.5, 29.2],
    ["ladd-mcconkey", "Ladd McConkey", "WR", "LAC", 29.9, 30.7, 30.3, 31.0],
    ["trey-mcbride", "Trey McBride", "TE", "ARI", 31.2, 32.0, 31.5, 32.3],
    ["josh-allen", "Josh Allen", "QB", "BUF", 33.0, 34.1, 33.7, 34.5],
    ["lamar-jackson", "Lamar Jackson", "QB", "BAL", 35.5, 36.3, 35.8, 36.7],
    ["chris-olave", "Chris Olave", "WR", "NO", 37.2, 38.1, 37.6, 38.5],
    ["mike-evans", "Mike Evans", "WR", "TB", 39.0, 39.8, 39.4, 40.1],
    ["jalen-hurts", "Jalen Hurts", "QB", "PHI", 40.8, 41.7, 41.2, 42.0],
    ["james-cook", "James Cook", "RB", "BUF", 42.4, 43.5, 42.9, 43.8],
    ["marv-harrison-jr", "Marvin Harrison Jr.", "WR", "ARI", 44.0, 44.9, 44.4, 45.3],
    ["kyren-williams", "Kyren Williams", "RB", "LAR", 46.1, 47.0, 46.5, 47.4],
    ["george-kittle", "George Kittle", "TE", "SF", 48.2, 49.1, 48.6, 49.5],
    ["dk-metcalf", "DK Metcalf", "WR", "PIT", 50.6, 51.8, 51.1, 52.0],
    ["kenneth-walker", "Kenneth Walker III", "RB", "SEA", 21.0, 20.6, 20.1, 20.2],
    ["david-montgomery", "David Montgomery", "RB", "DET", 55.4, 56.3, 55.9, 56.7],
    ["zay-flowers", "Zay Flowers", "WR", "BAL", 57.8, 58.9, 58.2, 59.2],
    ["tucker-kraft", "Tucker Kraft", "TE", "GB", 60.4, 61.5, 60.9, 61.9],
    ["jayden-daniels", "Jayden Daniels", "QB", "WAS", 63.1, 64.4, 63.7, 64.8],
    ["jordan-love", "Jordan Love", "QB", "GB", 67.0, 68.2, 67.6, 68.7],
    ["rome-odunze", "Rome Odunze", "WR", "CHI", 70.3, 71.6, 70.9, 72.0],
    ["jameson-williams", "Jameson Williams", "WR", "DET", 74.5, 75.8, 75.1, 76.2],
    ["alvin-kamara", "Alvin Kamara", "RB", "NO", 78.0, 79.4, 78.6, 79.9],
    ["courtland-sutton", "Courtland Sutton", "WR", "DEN", 82.6, 83.9, 83.1, 84.5],
    ["rj-harvey", "RJ Harvey", "RB", "DEN", 87.2, 88.8, 87.9, 89.1],
    ["caleb-williams", "Caleb Williams", "QB", "CHI", 91.4, 93.0, 92.2, 93.6],
    ["david-njoku", "David Njoku", "TE", "CLE", 96.3, 97.8, 97.0, 98.4],
    ["stefon-diggs", "Stefon Diggs", "WR", "NE", 101.1, 102.8, 101.9, 103.5],
    ["tyler-warren", "Tyler Warren", "TE", "IND", 106.8, 108.3, 107.5, 109.0]
  ];

  const pprOrder = [
    ["ja-marr-chase", 1, 23.1, 1], ["bijan-robinson", 2, 21.7, 1], ["justin-jefferson", 3, 21.1, 1],
    ["jahmyr-gibbs", 4, 20.4, 1], ["ceedee-lamb", 5, 20.5, 1], ["amon-ra-st-brown", 6, 19.6, 1],
    ["saquon-barkley", 7, 19.3, 1], ["puka-nacua", 8, 19.8, 1], ["christian-mccaffrey", 9, 19.1, 1],
    ["malik-nabers", 10, 18.8, 1], ["ashton-jeanty", 11, 18.1, 1], ["brian-thomas-jr", 12, 18.5, 1],
    ["nico-collins", 13, 18.1, 2], ["derrick-henry", 14, 17.6, 2], ["drake-london", 15, 17.3, 2],
    ["bucky-irving", 16, 16.9, 2], ["de-von-achane", 17, 17.0, 2], ["aj-brown", 18, 16.7, 2],
    ["josh-jacobs", 19, 16.2, 2], ["chase-brown", 20, 16.0, 2], ["jonathan-taylor", 21, 15.8, 2],
    ["ladd-mcconkey", 22, 16.0, 2], ["trey-mcbride", 23, 15.6, 2], ["josh-allen", 24, 24.5, 2],
    ["lamar-jackson", 25, 23.7, 2], ["chris-olave", 26, 15.2, 3], ["mike-evans", 27, 14.9, 3],
    ["jalen-hurts", 28, 22.9, 3], ["james-cook", 29, 14.8, 3], ["marv-harrison-jr", 30, 14.7, 3],
    ["kyren-williams", 31, 14.4, 3], ["george-kittle", 32, 14.0, 3], ["dk-metcalf", 33, 13.9, 3],
    ["kenneth-walker", 34, 13.8, 3], ["david-montgomery", 35, 13.2, 3], ["zay-flowers", 36, 13.3, 3],
    ["tucker-kraft", 37, 12.8, 3], ["jayden-daniels", 38, 21.8, 3], ["jordan-love", 39, 20.4, 4],
    ["rome-odunze", 40, 12.9, 4], ["jameson-williams", 41, 12.4, 4], ["alvin-kamara", 42, 12.3, 4],
    ["courtland-sutton", 43, 12.1, 4], ["rj-harvey", 44, 11.7, 4], ["caleb-williams", 45, 19.3, 4],
    ["david-njoku", 46, 11.6, 4], ["stefon-diggs", 47, 11.4, 4], ["tyler-warren", 48, 11.1, 4]
  ];

  const halfPprOrder = [
    ["bijan-robinson", 1, 19.5, 1], ["ja-marr-chase", 2, 19.6, 1], ["jahmyr-gibbs", 3, 18.6, 1],
    ["justin-jefferson", 4, 17.9, 1], ["ceedee-lamb", 5, 17.7, 1], ["saquon-barkley", 6, 17.9, 1],
    ["christian-mccaffrey", 7, 17.5, 1], ["amon-ra-st-brown", 8, 16.8, 1], ["ashton-jeanty", 9, 16.5, 1],
    ["puka-nacua", 10, 16.9, 1], ["derrick-henry", 11, 16.3, 1], ["malik-nabers", 12, 16.0, 1],
    ["bucky-irving", 13, 15.6, 2], ["de-von-achane", 14, 15.7, 2], ["brian-thomas-jr", 15, 15.8, 2],
    ["nico-collins", 16, 15.4, 2], ["josh-jacobs", 17, 15.3, 2], ["jonathan-taylor", 18, 15.2, 2],
    ["chase-brown", 19, 15.0, 2], ["aj-brown", 20, 14.6, 2], ["drake-london", 21, 14.8, 2],
    ["trey-mcbride", 22, 13.8, 2], ["ladd-mcconkey", 23, 14.2, 2], ["josh-allen", 24, 23.8, 2],
    ["lamar-jackson", 25, 22.8, 2], ["james-cook", 26, 14.0, 3], ["kyren-williams", 27, 13.7, 3],
    ["mike-evans", 28, 13.6, 3], ["chris-olave", 29, 13.5, 3], ["jalen-hurts", 30, 22.2, 3],
    ["marv-harrison-jr", 31, 13.1, 3], ["kenneth-walker", 32, 13.2, 3], ["george-kittle", 33, 12.9, 3],
    ["david-montgomery", 34, 12.7, 3], ["dk-metcalf", 35, 12.6, 3], ["zay-flowers", 36, 12.1, 3],
    ["jayden-daniels", 37, 21.2, 3], ["tucker-kraft", 38, 11.7, 4], ["jordan-love", 39, 19.6, 4],
    ["alvin-kamara", 40, 11.6, 4], ["rome-odunze", 41, 11.6, 4], ["jameson-williams", 42, 11.1, 4],
    ["courtland-sutton", 43, 10.9, 4], ["rj-harvey", 44, 10.7, 4], ["caleb-williams", 45, 18.8, 4],
    ["david-njoku", 46, 10.6, 4], ["tyler-warren", 47, 10.3, 4], ["stefon-diggs", 48, 10.2, 4]
  ];

  const playerMap = Object.fromEntries(players.map(([id, name, position, team, yahoo, sleeper, rtSports, realTime]) => [
    id, { id, name, position, team, adp: { yahoo, sleeper, rtSports, realTime } }
  ]));

  const toRankings = (entries) => entries.map(([id, rank, projectedPoints, tier]) => ({
    ...playerMap[id], rank, projectedPoints, tier
  }));

  window.DRAFT_DASHBOARD_DATA = {
    meta: {
      dataLastRefreshed: "2026-07-30T13:00:00-07:00",
      isSampleData: true,
      leagueSeason: 2026
    },
    sources: {
      yahoo: { name: "Yahoo", role: "Primary ADP", refreshedAt: "2026-07-30T12:45:00-07:00", weight: 0.55 },
      sleeper: { name: "Sleeper", role: "Market comparison", refreshedAt: "2026-07-30T12:40:00-07:00", weight: 0.2 },
      rtSports: { name: "RTSports", role: "Market comparison", refreshedAt: "2026-07-30T12:35:00-07:00", weight: 0.15 },
      realTime: { name: "Real-Time", role: "Market comparison", refreshedAt: "2026-07-30T12:30:00-07:00", weight: 0.1 }
    },
    rankings: {
      ppr: {
        label: "PPR",
        provisional: false,
        items: toRankings(pprOrder)
      },
      halfPpr: {
        label: "Half-PPR",
        provisional: true,
        note: "This provisional half-PPR board is a scoring adjustment of the seeded PPR source. Replace it with a dedicated half-PPR export before drafting.",
        items: toRankings(halfPprOrder)
      }
    }
  };
}());
