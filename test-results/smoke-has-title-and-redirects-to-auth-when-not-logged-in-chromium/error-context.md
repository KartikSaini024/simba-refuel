# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img "Simba Car Hire"
      - heading "Simba Car Hire" [level=3] [ref=e6]
      - paragraph [ref=e7]: Refuel Management System
    - generic [ref=e9]:
      - tablist [ref=e10]:
        - tab "Sign In" [selected] [ref=e11] [cursor=pointer]
        - tab "Sign Up" [ref=e12] [cursor=pointer]
      - tabpanel "Sign In" [ref=e13]:
        - generic [ref=e14]:
          - generic [ref=e15]:
            - text: Email
            - textbox "Email" [ref=e16]
          - generic [ref=e17]:
            - text: Password
            - textbox "Password" [ref=e18]
          - button "Sign In" [ref=e19] [cursor=pointer]
```