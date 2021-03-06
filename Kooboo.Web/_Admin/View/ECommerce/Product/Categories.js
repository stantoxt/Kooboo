$(function() {

    var jsTree = null;

    var cateModel = function() {
        var self = this;

        this.defaultLang = ko.observable();
        this.cultures = ko.observable();
        this.cultureKeys = ko.observableArray();

        this.currentCateNames = ko.observable();

        this.showMultilingualModal = ko.observable(false);
        this.onHideMultilingualModal = function() {
            self.showMultilingualModal(false);
        }
        this.onSaveMultilingualModal = function() {
            self.currentNode().node.data.names = self.currentCateNames();
            self.currentNode().instance.set_text(self.currentNode().node, self.currentCateNames()[self.defaultLang()])
            self.onHideMultilingualModal();
        }

        this.cateData = ko.observable();
        this._cateData = ko.observable();

        this.categories = ko.observableArray();

        this.currentNode = ko.observable();
        this.showFunctionBtn = ko.observable(false);

        this.onAddNewCategory = function() {
            var newNode = jsTree.create_node(null, {
                id: 'id_' + Kooboo.Guid.NewGuid() + '_' + (+new Date()),
                data: { id: Kooboo.Guid.Empty, names: {} },
                text: Kooboo.text.common.name,
                subCats: []
            })

            var inst = $.jstree.reference(newNode);
            inst.edit(newNode);
        }

        this.onAddNewSubCategory = function() {
            var rel = jsTree.get_selected();
            var subNode = jsTree.create_node(rel[0], {
                id: 'id_' + Kooboo.Guid.NewGuid() + '_' + (+new Date()),
                data: { id: Kooboo.Guid.Empty, names: {} },
                text: Kooboo.text.common.name,
                subCats: []
            });

            var inst = $.jstree.reference(subNode);
            inst.edit(subNode);
        }

        this.removeCategory = function() {
            var id = self.currentNode().node.data.id;

            if (id !== Kooboo.Guid.Empty) {
                Kooboo.ProductCategory.checkProuctCount({
                    id: id
                }).then(function(res) {
                    if (res.success) {
                        if (res.model) {
                            if (confirm("This category is related to some products. Would you want to delete?")) {
                                deleteById(id);
                            }
                        } else {
                            deleteById(id);
                        }
                    }
                })
            } else {
                jsTree.delete_node(self.currentNode().node);
            }

            function deleteById(id) {
                Kooboo.ProductCategory.Delete({
                    id: id
                }).then(function(res) {
                    if (res.success) {
                        jsTree.delete_node(self.currentNode().node);
                    }
                })
            }
        }

        this.onEdit = function() {
            var id = self.currentNode().selected[0],
                inst = self.currentNode().instance;

            if (self.cultureKeys().length > 1) {
                // 如果有多种，显示弹窗
                self.currentCateNames(inst._model.data[id].data.names);
                self.showMultilingualModal(true);
            } else {
                // 如果只有一种语言，直接编辑
                inst.edit(id);
            }
        }

        this.demappingCategoriesData = function(data) {
            var temps = [];

            data.forEach(function(cate, i) {
                temps.push({
                    id: 'id_' + Kooboo.Guid.NewGuid() + '_' + (+new Date()),
                    data: { id: cate.id, names: JSON.parse(cate.values) },
                    state: {},
                    text: cate.name,
                    children: (cate.subCats && cate.subCats.length) ? self.demappingCategoriesData(cate.subCats) : []
                })

            })
            return temps;
        }

        this.isJsTreeChanged = ko.observable(false);
        this.saveCategory = function() {
            Kooboo.ProductCategory.post(this.getSaveData(jsTree.get_json())).then(function(res) {
                if (res.success) {
                    window.info.show(Kooboo.text.info.save.success, true);
                }
            })
        }

        this.compareTags = function(origData, newData) {
            if (!origData) origData = self._cateData();
            if (!newData) newData = this.getSaveData(jsTree.get_json());

            if (origData.length !== newData.length) {
                return true;
            } else {
                var flag = false;
                for (var i = 0; i < origData.length; i++) {
                    var origItem = origData[i],
                        newItem = newData[i];

                    if (origItem.id !== newItem.id) {
                        flag = true;
                        break;
                    }

                    if (origItem.name !== newItem.name) {
                        flag = true;
                        break;
                    }

                    if (origItem.subCats.length !== newItem.subCats.length) {
                        flag = true;
                        break;
                    }

                    flag = (flag || self.compareTags(origItem.subCats, newItem.subCats));
                }

                return flag;
            }
        }

        this.getSaveData = function(data) {
            var temps = [];

            data.forEach(function(cate, i) {
                temps.push({
                    id: cate.data.id,
                    name: cate.text,
                    values: JSON.stringify(cate.data.names || {}),
                    subCats: (cate.children && cate.children.length) ? self.getSaveData(cate.children) : []
                })
            })

            return temps;
        }

        $.when(
            Kooboo.ProductCategory.getList(),
            Kooboo.Site.Langs()
        ).then(function(r1, r2) {
            var cateRes = r1[0],
                langRes = r2[0];

            if (cateRes.success && langRes.success) {
                self.defaultLang(langRes.model.default);
                self.cultures(langRes.model.cultures);
                self.cultureKeys(Object.keys(self.cultures()));
                self.cateData(cateRes.model);
                self._cateData(cateRes.model);

                var jsTreeDom = $('#categories').jstree({
                    "plugins": ["dnd", "types"],
                    "types": {
                        "default": {
                            "icon": "fa fa-tag icon-color-dark"
                        }
                    },
                    core: {
                        strings: { 'Loading ...': Kooboo.text.common.loading + ' ...' },
                        theme: { name: 'proton', responsive: true },
                        check_callback: true,
                        data: function(node, callback) {
                            callback.call(node, self.demappingCategoriesData(self.cateData()));
                        }
                    }
                }).on("ready.jstree", function(e, data) {
                    $(this).data("jstree").open_all();
                }).on("select_node.jstree", function(e, selected) {
                    self.showFunctionBtn(true);
                    self.currentNode(selected);
                }).on("deselect_node.jstree", function() {
                    self.showFunctionBtn(false);
                }).on("create_node.jstree", function(e, data) {
                    $(this).data("jstree").open_all();
                    self.isJsTreeChanged(self.compareTags());
                }).on("delete_node.jstree", function(e, data) {
                    $(this).data("jstree").open_all();
                    self.showFunctionBtn(false);
                    // self.isJsTreeChanged(self.compareTags());
                }).on("rename_node.jstree", function(e, data) {
                    $(this).data("jstree").open_all();
                    self.isJsTreeChanged(self.compareTags());
                    data.node.data.names[self.defaultLang()] = data.text;
                }).on('move_node.jstree', function(e, data) {
                    $(this).data("jstree").open_all();
                    self.isJsTreeChanged(self.compareTags());
                });

                jsTree = jsTreeDom.data('jstree');
            }
        })
    }

    var vm = new cateModel();
    ko.applyBindings(vm, document.getElementById('main'));
})