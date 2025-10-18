<template>
  <div class="drone-control">
   <div class="tab">
    <div class="tab-header">
      <div :class="['tab-item',{active:currentTab==='histroyTrack'}]" @click="handleTabClick('histroyTrack')">历史轨迹</div>
      <div :class="['tab-item',{active:currentTab==='realtimeTrack'}]" @click="handleTabClick('realtimeTrack')">实时轨迹</div>
      <el-button>导入KML文件</el-button>
      <el-button>导出KML文件</el-button>
    </div>
    <HistoryTrack v-if="currentTab==='histroyTrack'"/>
    <RealtimeTrack v-if="currentTab==='realtimeTrack'"/>
   </div>
  </div>
</template>

<script setup>
import HistoryTrack from './HistoryTrack';
import RealtimeTrack from './RealtimeTrack';

const currentTab = ref("realtimeTrack");

const handleTabClick=(value)=>{
  currentTab.value=value
}

</script>

<style scoped>
.drone-control {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  min-width: 400px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.2);
}
.tab-header{
  display: flex;
  align-items: center;
}
.tab-item{
  margin: 0 10px;
  cursor: pointer;
}
.active{
  color: red;
}
</style>
    