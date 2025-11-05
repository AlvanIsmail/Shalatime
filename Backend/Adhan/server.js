const express = require ("express");
const axios = require("axios");
const cors = require("cors");
const dayjs = require("dayjs");     
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const app = express();
app.use(cors());

app.get("/", (req, res) => {
    res.send("Prayer Times API is Running");    
});

app.get("/prayer-times", async (req, res) => {

    try{
        const{city, country, lat, long, method = 2} = req.query;
        let apiURL;

        if (lat && long){
            apiURL = `https://api.aladhan.com/v1/timings/${Math.floor(Date.now() / 1000)}?latitude=${lat}&longitude=${long}&method=${method}`;
        } else if(city && country){
            apiURL = `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=${method}`;
        } else {
            return res.status(400).json({error: "Please provide either lat & long or city & country"}); 
        }

        const response = await axios.get(apiURL);
        const data = response.data.data;

        const timings = {
            Fajr: data.timings.Fajr,
            Sunrise: data.timings.Sunrise,
            Dhuhr: data.timings.Dhuhr,
            Asr: data.timings.Asr,
            Maghrib: data.timings.Maghrib,
            Isha: data.timings.Isha,
        };

        const now = dayjs().tz("Asia/Jakarta");
        let nextPrayer = null;
        let timeRemaining = null;

        for (const [prayer, time] of Object.entries(timings)) {
            const prayerTime = dayjs(
                `${now.format("YYYY-MM-DD")} ${time}`,
                "YYYY-MM-DD HH:mm"
            );

            if (prayerTime.isAfter(now)) {
                nextPrayer = prayer;
                timeRemaining = prayerTime.diff(now, "minute");
                break;
            }
        }

        const cleanData = {
            date: {
                gregorian: data.date.readable,
                hijri: data.date.hijri.date,
                hijriMonth: data.date.hijri.month.en,
                weekday: data.date.gregorian.weekday.en,
            },
            timings, 
            nextPrayer: {
                prayer: nextPrayer,
                minutesUntil: timeRemaining,
            },
        };
            console.log("Sending response...");
            res.json(cleanData);
        } catch (error) {
            console.error(error.message);
            res.status(500).json({error: "Failed to fetch prayer times"});
        }
    });

    app.get("/prayer-times/auto", async (req, res) => {
  try {
    const ipRes = await axios.get("https://ipapi.co/json/");
    console.log("IP API raw:", ipRes.data);

    const { city, country_name: country } = ipRes.data;
    console.log("Detected:", city, country);

    const response = await axios.get(
      `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=2`
    );

    const data = response.data.data;
    const timings = {
      Fajr: data.timings.Fajr,
      Sunrise: data.timings.Sunrise,
      Dhuhr: data.timings.Dhuhr,
      Asr: data.timings.Asr,
      Maghrib: data.timings.Maghrib,
      Isha: data.timings.Isha,
    };

    const timezoneName = data.meta.timezone || "Asia/Jakarta";
    const now = dayjs().tz(timezoneName);

    let nextPrayer = null;
    let timeRemaining = null;

    // ✅ Create a new instance of dayjs for each prayer time
    for (const [prayer, time] of Object.entries(timings)) {
      const [hour, minute] = time.split(":").map(Number);
      const prayerTime = dayjs().tz(timezoneName).hour(hour).minute(minute).second(0);

      if (prayerTime.isAfter(now)) {
        nextPrayer = prayer;
        const diffMinutes = prayerTime.diff(now, "minute");
        const h = Math.floor(diffMinutes / 60);
        const m = diffMinutes % 60;
        timeRemaining = `${h}h ${m}m`;
        break;
      }
    }

    // 🟣 Handle the “after Isha” case — go to tomorrow’s Fajr
    if (!nextPrayer) {
      const [hour, minute] = timings.Fajr.split(":").map(Number);
      const fajrTomorrow = dayjs().tz(timezoneName).add(1, "day").hour(hour).minute(minute).second(0);
      const diffMinutes = fajrTomorrow.diff(now, "minute");
      const h = Math.floor(diffMinutes / 60);
      const m = diffMinutes % 60;
      nextPrayer = "Fajr";
      timeRemaining = `${h}h ${m}m`;
    }

    const cleaned = {
      location: { city, country },
      date: {
        gregorian: `${data.date.readable} (${data.date.gregorian.weekday.en})`,
        hijri: `${data.date.hijri.date} (${data.date.hijri.month.en})`,
      },
      timings,
      nextPrayer: {
        name: nextPrayer,
        in: timeRemaining,
      },
    };

    res.json(cleaned);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to auto-detect prayer times" });
  }
});

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));