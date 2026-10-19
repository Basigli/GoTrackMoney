package ledger

import (
	"fmt"
	"time"
)

type duplicateExpenseMatch struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Amount        float64   `json:"amount"`
	CategoryID    int64     `json:"category_id"`
	CategoryName  string    `json:"category_name"`
	CategoryEmoji string    `json:"category_emoji"`
	SpentOn       time.Time `json:"spent_on"`
	IsPeriodic    bool      `json:"is_periodic"`
}

type duplicateExpenseError struct {
	Matches []duplicateExpenseMatch `json:"matches"`
	Total   int64                   `json:"total"`
}

func (*duplicateExpenseError) Error() string { return "possible duplicate expense" }

// Midnight boundaries use calendar arithmetic so DST days can span 23 or 25 hours.
func expenseDayBounds(spentOn *time.Time, timezone string) (time.Time, time.Time, time.Time, error) {
	if timezone == "" {
		timezone = "UTC"
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return time.Time{}, time.Time{}, time.Time{}, fmt.Errorf("invalid timezone")
	}
	date := time.Now().UTC()
	if spentOn != nil {
		date = *spentOn
	}
	local := date.In(location)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	return start, start.AddDate(0, 0, 1), date, nil
}
