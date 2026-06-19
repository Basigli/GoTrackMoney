package ledger

import "time"

type createUserParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type createCategoryParams struct {
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Type  string `json:"type"`
	Color string `json:"color"`
}

type createExpenseParams struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	CategoryID  int64      `json:"category_id"`
	SpentOn     *time.Time `json:"spent_on,omitempty"`
}

type createIncomeParams struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	CategoryID  int64      `json:"category_id"`
	ReceivedOn  *time.Time `json:"received_on,omitempty"`
}

type loginParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type updateCategoryParams struct {
	ID    int64
	Name  string `json:"name"`
	Emoji string `json:"emoji"`
	Type  string `json:"type"`
	Color string `json:"color"`
}

type updateExpenseParams struct {
	ID          int64
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	CategoryID  int64      `json:"category_id"`
	SpentOn     *time.Time `json:"spent_on,omitempty"`
}

type updateIncomeParams struct {
	ID          int64
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	CategoryID  int64      `json:"category_id"`
	ReceivedOn  *time.Time `json:"received_on,omitempty"`
}

type createPeriodicExpenseParams struct {
	Name           string     `json:"name"`
	Description    string     `json:"description"`
	Amount         float64    `json:"amount"`
	CategoryID     int64      `json:"category_id"`
	PeriodInterval int32      `json:"period_interval"`
	PeriodUnit     string     `json:"period_unit"`
	StartDate      *time.Time `json:"start_date,omitempty"`
}

type updatePeriodicExpenseParams struct {
	ID             int64
	PeriodInterval int32      `json:"period_interval"`
	PeriodUnit     string     `json:"period_unit"`
	NextDueDate    *time.Time `json:"next_due_date,omitempty"`
}

type periodicExpenseResponse struct {
	ID                 int64      `json:"id"`
	Name               string     `json:"name"`
	Description        string     `json:"description"`
	Amount             float64    `json:"amount"`
	CategoryID         int64      `json:"category_id"`
	PeriodInterval     int32      `json:"period_interval"`
	PeriodUnit         string     `json:"period_unit"`
	StartDate          time.Time  `json:"start_date"`
	LastGeneratedDate  *time.Time `json:"last_generated_date"`
	NextDueDate        time.Time  `json:"next_due_date"`
	CreatedAt          time.Time  `json:"created_at"`
}
