Vue.createApp({
  data() {
    return {
      sitename: "AfterSchool",
      serverURL: "https://afterschoolbackend.vercel.app/",
      pages: ["Home", "My Orders"],
      currentPage: "Home",
      lessons: null,
      search: "",
      sortBy: "subject",
      sortOrderAsc: true,
      savedLessons: [],
      cart: [],
      user: {
        name: "",
        phone: "",
        isNameValid: false,
        isPhoneValid: false,
        ipAddress: "",
      },
      lessonsLoading: false,
      checkoutSuccessful: false,
      lessonsErrorMessage: "No lessons found.",
      orderErrorMessage: "Order Failed!",
      myOrders: null,
      myOrdersSearch: "",
      myOrdersLoading: false,
      ratingModalOneOrder: {},
      ratingModalTwoLesson: {},
      userRating: 0,
      ratingMessage: "",
    };
  },

  created() {
    this.getLessons();
  },

  mounted() {
    this.sortOptionsSelector();
  },

  watch: {
    search: "getLessons",
    sortBy: "getLessons",
    sortOrderAsc: "getLessons",
    myOrdersSearch: "getMyOrders",
    currentPage(page) {
      if (page == "Home") {
        this.$nextTick(() => {
          this.sortOptionsSelector();
        });
      }
    },
  },

  methods: {
    // Function to send request to the server
    async sendRequestToServer(route, data, method = "POST") {
      const URL = `${this.serverURL}${route}`;
      const requestOptions = {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      };
      const response = await fetch(URL, requestOptions);
      return await response.json();
    },

    // Function to retrieve all or filtered (if parameters given) lessons from the server
    async getLessons() {
      this.lessonsLoading = true;
      const data = {
        search: this.search,
        sortBy: this.sortBy,
        sortOrder: this.sortOrderAsc ? "asc" : "desc",
      };
      try {
        this.lessons = await this.sendRequestToServer("lessons", data);
        this.savedLessons = this.search ? this.savedLessons : this.lessons;
      } catch (error) {
        this.lessons = [];
        this.lessonsErrorMessage = "Failed to load lessons.";
        console.log(`${this.lessonsErrorMessage} Error: ${error}`);
      }
      this.lessonsLoading = false;
    },

    // Function to change sort order - ASC or DESC
    toggleSortOrder() {
      this.sortOrderAsc = !this.sortOrderAsc;
    },

    // Add to Cart Functionality
    addToCart(lesson) {
      if (this.canAddToCart(lesson)) {
        this.cart.push(lesson._id);
      }
    },

    removeFromCart(lesson) {
      const index = this.cart.lastIndexOf(lesson._id);
      if (index > -1) {
        this.cart.splice(index, 1);
      }
    },

    cartItemCount(lessonId) {
      return this.cart.filter((id) => id === lessonId).length;
    },

    canAddToCart(lesson) {
      return lesson.spaces > this.cartItemCount(lesson._id);
    },

    canRemoveFromCart(lesson) {
      return this.cartItemCount(lesson._id) > 0;
    },

    emptyCart() {
      this.cart = [];
    },
    // End of Add to Cart Functionality

    // Function to switch between lessons and checkout page
    showCheckout() {
      const page = this.currentPage == "Checkout" ? "Home" : "Checkout";
      this.switchPage(page);
    },

    // Checkout Functionality
    isUserNameValid() {
      this.user.isNameValid = /^[a-zA-Z]+$/.test(this.user.name);
    },

    isUserPhoneValid() {
      this.user.isPhoneValid = /^\d+$/.test(this.user.phone);
    },

    async submitOrder(event) {
      const btn = event.target.querySelector('[type="submit"]');
      const btnText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = btnLoader;
      const modal = document.getElementById("checkoutResult");

      try {
        if (!(this.user.isNameValid && this.user.isPhoneValid)) {
          this.orderErrorMessage = "Username or phone is invalid.";
          throw Error(this.orderErrorMessage);
        }

        const data = {
          username: this.user.name,
          phone: parseInt(this.user.phone),
          booked_lessons: this.cartDetails.map((item) => ({
            _id: item._id,
            quantity: item.quantity,
            total: item.total,
          })),
          total_price: this.cartTotal,
        };
        const result = await this.sendRequestToServer("order/new", data);
        if (result.orderSuccessful) {
          this.checkoutSuccessful = true;
          this.cart = [];
          this.showCheckout();
          this.getLessons();
        } else {
          this.orderErrorMessage = result.errorMessage;
          throw Error(this.orderErrorMessage);
        }
      } catch (error) {
        console.log(error);
      } finally {
        new mdb.Modal(modal).show();
        modal.addEventListener("hidden.mdb.modal", (e) => {
          this.checkoutSuccessful = false;
        });
        btn.disabled = false;
        btn.innerHTML = btnText;
      }
    },
    // End of Checkout Functionality

    switchPage(page) {
      this.currentPage = page;
      if (page == "My Orders") {
        this.getMyOrders();
      }
      window.scrollTo(0, 0);
    },

    // Function to get user's order history
    async getMyOrders() {
      this.myOrdersLoading = true;
      const data = { search: this.myOrdersSearch };
      try {
        this.myOrders = await this.sendRequestToServer("order/myorders", data);
        if (!this.myOrdersSearch) {
          this.user.ipAddress = this.myOrders[0].ip_address;
        }
      } catch (error) {
        this.myOrders = [];
        console.log(`Error getting orders: ${error}`);
      }
      this.myOrdersLoading = false;
    },

    // Function to rate a lesson
    async rateLesson(event) {
      const btn = event.target;
      const btnText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = btnLoader;

      try {
        const data = {
          lessonId: this.ratingModalTwoLesson._id,
          rating: this.userRating,
        };
        const result = await this.sendRequestToServer(
          "lessons/rate",
          data,
          "PUT"
        );
        if (result.ratingSuccessful) {
          this.ratingMessage = "Thanks for rating!";
          await this.getMyOrders();
          this.ratingModalOneOrder =
            this.myOrders.filter(
              (order) => order._id == this.ratingModalOneOrder._id
            )[0] || {};
          this.getLessons();
        }
      } catch (error) {
        this.ratingMessage = error;
        console.log(error);
      }

      btn.disabled = false;
      btn.innerHTML = btnText;
    },

    sortOptionsSelector() {
      new mdb.Select(document.getElementById("sortBy"));
    },
  },

  computed: {
    // Shopping Cart Functionality
    cartDetails() {
      const uniqueLessonIds = Array.from(new Set(this.cart));
      return uniqueLessonIds.map((lessonId) => {
        const lesson = this.savedLessons.find(
          (lesson) => lesson._id === lessonId
        );
        const quantity = this.cartItemCount(lessonId);
        return {
          ...lesson,
          quantity,
          total: quantity * lesson.price,
        };
      });
    },

    cartTotal() {
      return this.cartDetails.reduce((sum, lesson) => sum + lesson.total, 0);
    },
    // End of Shopping Cart Functionality
  },
}).mount("#app");

const btnLoader = `<div class="d-flex gap-2 align-items-center">
    <span class="spinner-border spinner-border-sm"></span> Please wait...
  </div>`;
